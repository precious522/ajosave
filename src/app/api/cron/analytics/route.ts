import { NextRequest, NextResponse } from "next/server";
import { aggregateDailyAnalytics } from "@/server/services/analytics.service";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Cron endpoint to aggregate daily circle performance analytics.
 * Should be called daily by a scheduler (e.g. Vercel Crons, GitHub Actions, etc.).
 *
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const unauth = verifyCronSecret(req);
  if (unauth) return unauth;

  try {
    await aggregateDailyAnalytics();

    return NextResponse.json({
      success: true,
      message: "Daily analytics aggregated successfully",
    });
  } catch (error) {
    console.error("Failed to aggregate daily analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to aggregate daily analytics",
      },
      { status: 500 }
    );
  }
}
