import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserSessions, hashToken } from "@/lib/sessions";
import type { ApiResponse } from "@/types";
import type { SessionInfo } from "@/lib/sessions";
import { getToken } from "next-auth/jwt";

/**
 * GET /api/v1/sessions
 * Get all active sessions for the current user
 */
export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ sessions: SessionInfo[] }>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the current session ID from the JWT token
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const currentSessionId = token?.sessionId as string | undefined;

    // Get all sessions for the user
    const sessions = await getUserSessions(session.user.id);

    // Mark the current session
    const sessionsWithCurrent = sessions.map((s) => ({
      ...s,
      isCurrent: currentSessionId ? s.id.startsWith(session.user.id) : false,
    }));

    return NextResponse.json({
      success: true,
      data: { sessions: sessionsWithCurrent },
    });
  } catch (error) {
    console.error("[sessions] Error fetching sessions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
