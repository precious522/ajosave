import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredSessions } from "@/lib/sessions";
import { verifyCronAuth } from "@/lib/cron-auth";
import type { ApiResponse } from "@/types";

/**
 * POST /api/v1/cron/cleanup-sessions
 * Clean up expired sessions from the database
 * Should be called periodically (e.g., daily)
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ deletedCount: number }>>> {
  // Verify cron authentication
  const authError = verifyCronAuth(req);
  if (authError) {
    return authError;
  }

  try {
    const deletedCount = await cleanupExpiredSessions();

    console.log(`[cron] Cleaned up ${deletedCount} expired sessions`);

    return NextResponse.json({
      success: true,
      data: { deletedCount },
    });
  } catch (error) {
    console.error("[cron] Error cleaning up sessions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cleanup sessions" },
      { status: 500 }
    );
  }
}
