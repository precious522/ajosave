import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyOtpSchema } from "@/types/schemas";
import { getRedis } from "./redis";
import { query } from "./db";
import { isLockedOut, recordFailure, resetLockout } from "./lockout";

const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

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

        // Load user from DB
        const result = await query<{ id: string; phone: string; name: string; role: string }>(
          "SELECT id, phone, display_name as name, role FROM users WHERE phone = $1",
          [phone]
        );
        const user = result.rows[0];

        if (!user) {
          // Upsert: create user record on first successful OTP verification
          const { rows } = await query<{ id: string; phone: string; name: string; role: string }>(
            `INSERT INTO users (id, phone, display_name, role, reputation_score, created_at)
             VALUES (gen_random_uuid(), $1, 'Ajosave User', 'user', 0, NOW())
             ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
             RETURNING id, phone, display_name as name, role`,
            [phone]
          );
          return rows[0];
        }

        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const now = Math.floor(Date.now() / 1000);

      // Initial sign-in: stamp both expiry times
      if (user) {
        token.id = user.id;
        token.phone = (user as { phone?: string }).phone;
        token.role = (user as { role?: string }).role ?? "user";
        token.accessTokenExpires = now + ACCESS_TOKEN_TTL;
        token.refreshTokenExpires = now + REFRESH_TOKEN_TTL;
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
      return session;
    },
  },
};
