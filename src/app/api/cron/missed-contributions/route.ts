import { NextRequest, NextResponse } from "next/server";
import { processMissedContributions } from "@/server/services/scheduler.service";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Cron endpoint to process missed contributions
 * Should be called daily by a cron service (Vercel Cron, GitHub Actions, etc.)
 * 
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const unauth = verifyCronSecret(req);
  if (unauth) return unauth;

  try {
    await processMissedContributions();

    return NextResponse.json({
      success: true,
      message: "Missed contributions processed successfully",
    });
  } catch (error) {
    console.error("Failed to process missed contributions:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to process missed contributions" 
      },
      { status: 500 }
    );
  }
}
