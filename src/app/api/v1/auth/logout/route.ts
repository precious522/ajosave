import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 * Invalidates the session server-side (clears the JWT cookie via NextAuth signOut).
 * TODO: when Redis is wired up, also add the refresh token to a denylist here.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // TODO: redis.set(`revoked:${token.id}`, 1, { EX: REFRESH_TOKEN_TTL })
  // The client must call next-auth signOut() to clear the cookie.
  return NextResponse.json({ ok: true });
}
