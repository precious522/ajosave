import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyOtpSchema } from "@/types/schemas";
import { getRedis } from "./redis";
import { query } from "./db";
import { isLockedOut, recordFailure, resetLockout } from "./lockout";
import { generateRefreshToken, getTokenExpiries } from "./refresh-tokens";
import { encrypt, hmacIndex } from "./encryption";

const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

// Store pending session data temporarily (will be created in signIn event)
const pendingSessionData = new Map<string, { sessionId: string; expiresAt: Date }>();

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: REFRESH_TOKEN_TTL },
  pages: { signIn: "/auth/login", error: "/auth/error" },
  providers: [
    CredentialsProvider({
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        const parsed = verifyOtpSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { phone, otp } = parsed.data;

        // Check for account lockout (brute-force protection)
        if (await isLockedOut(phone)) {
          throw new Error("Account locked due to too many failed attempts. Please try again in 30 minutes.");
        }

        // Verify OTP from Redis
        const redis = await getRedis();
        const storedOtp = await redis.get(`otp:${phone}`);

        if (!storedOtp || storedOtp !== otp) {
          await recordFailure(phone);
          throw new Error("Invalid or expired OTP. Please try again.");
        }

        // Reset failure tracking on success
        await resetLockout(phone);
        await redis.del(`otp:${phone}`); // OTP is single-use

        // Load user via blind index (phone_hash) — never compare plaintext
        const phoneHash = hmacIndex(phone);
        const result = await query<{ id: string; phone: string; name: string; role: string }>(
          "SELECT id, phone, display_name as name, role FROM users WHERE phone_hash = $1",
          [phoneHash]
        );
        const user = result.rows[0];

        if (!user) {
          // Upsert: create user record on first successful OTP verification
          const { rows } = await query<{ id: string; phone: string; name: string; role: string }>(
            `INSERT INTO users (id, phone, phone_hash, display_name, role, reputation_score, created_at)
             VALUES (gen_random_uuid(), $1, $2, 'Ajosave User', 'user', 0, NOW())
             ON CONFLICT (phone_hash) DO UPDATE SET phone = EXCLUDED.phone
             RETURNING id, phone, display_name as name, role`,
            [encrypt(phone), phoneHash]
          );
          return rows[0];
        }

        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      const now = Math.floor(Date.now() / 1000);

      // Initial sign-in: generate refresh token and stamp both expiry times
      if (user) {
        const refreshToken = await generateRefreshToken(user.id);
        token.id = user.id;
        token.phone = (user as { phone?: string }).phone;
        token.role = (user as { role?: string }).role ?? "user";
        token.refreshToken = refreshToken;
        const expiries = getTokenExpiries();
        token.accessTokenExpires = expiries.accessTokenExpires;
        token.refreshTokenExpires = expiries.refreshTokenExpires;
        return token;
      }

      // Access token still valid
      if (now < (token.accessTokenExpires as number)) {
        return token;
      }

      // Refresh token expired → force logout
      if (now >= (token.refreshTokenExpires as number)) {
        return { ...token, error: "RefreshTokenExpired" };
      }

      // Silent refresh: issue a new access token window
      return {
        ...token,
        accessTokenExpires: now + ACCESS_TOKEN_TTL,
      };
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { phone?: string }).phone = token.phone as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      (session as { accessTokenExpires?: number }).accessTokenExpires =
        token.accessTokenExpires as number;
      (session as { error?: string }).error = token.error as string | undefined;
      (session as { sessionId?: string }).sessionId = token.sessionId as string;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Create session record in database when user signs in
      // Note: We can't access the request object here, so we'll create a simplified session
      // The full session with device info will be created on the first API request
      const sessionData = pendingSessionData.get(user.id);
      if (sessionData) {
        try {
          const tokenHash = hashToken(sessionData.sessionId);
          // Create a basic session record (will be updated with device info on first request)
          await query(
            `INSERT INTO sessions (user_id, token_hash, device_name, device_type, browser, os, ip_address, user_agent, last_active_at, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
             ON CONFLICT (token_hash) DO UPDATE SET last_active_at = NOW()`,
            [
              user.id,
              tokenHash,
              "Web Browser",
              "desktop",
              "Unknown",
              "Unknown",
              "Unknown",
              "Unknown",
              sessionData.expiresAt,
            ]
          );
        } catch (error) {
          console.error("[auth] Failed to create session:", error);
        } finally {
          pendingSessionData.delete(user.id);
        }
      }
    },
  },
};
