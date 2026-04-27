import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyOtpSchema } from "@/types/schemas";

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
        // TODO: verify OTP from Redis and load user from DB
        return { id: "placeholder-id", phone: parsed.data.phone, name: "Ajosave User", role: "user" };
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
