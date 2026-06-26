import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revokeAllOtherSessions, revokeAllSessions } from "@/lib/sessions";
import type { ApiResponse } from "@/types";
import { getToken } from "next-auth/jwt";

/**
 * POST /api/v1/sessions/revoke-all
 * Revoke all sessions for the current user
 * Query param: keepCurrent=true to keep the current session active
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ revokedCount: number }>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const keepCurrent = searchParams.get("keepCurrent") === "true";

    let revokedCount = 0;

    if (keepCurrent) {
      // Get the current session ID from the JWT token
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      const currentSessionId = token?.sessionId as string | undefined;

      if (currentSessionId) {
        revokedCount = await revokeAllOtherSessions(session.user.id, currentSessionId);
      } else {
        // If we can't identify the current session, revoke all
        revokedCount = await revokeAllSessions(session.user.id);
      }
    } else {
      // Revoke all sessions including current
      revokedCount = await revokeAllSessions(session.user.id);
    }

    return NextResponse.json({
      success: true,
      data: { revokedCount },
    });
  } catch (error) {
    console.error("[sessions] Error revoking all sessions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke sessions" },
      { status: 500 }
    );
  }
}
