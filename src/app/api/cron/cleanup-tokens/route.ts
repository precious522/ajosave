import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredTokens } from "@/lib/refresh-tokens";
import { serverConfig } from "@/server/config";
import type { ApiResponse } from "@/types";

/**
 * GET /api/cron/cleanup-tokens
 * Cleans up expired refresh tokens from the database.
 * Should be called periodically (e.g., daily) via a cron service.
 * 
 * Requires CRON_SECRET header for authentication.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!cronSecret || cronSecret !== serverConfig.cronSecret) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const deletedCount = await cleanupExpiredTokens();
    return NextResponse.json<ApiResponse<{ deletedCount: number }>>(
      {
        success: true,
        data: { deletedCount },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[cleanup-tokens] Error:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to cleanup tokens" },
      { status: 500 }
    );
  }
}
