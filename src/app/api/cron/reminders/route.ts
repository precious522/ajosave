import { NextRequest, NextResponse } from "next/server";
import { sendPayoutReminders } from "@/server/services/scheduler.service";
import { serverConfig } from "@/server/config";

/**
 * Cron endpoint to send payout reminders
 * Should be called hourly by a cron service (Vercel Cron, GitHub Actions, etc.)
 * 
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (token !== serverConfig.cronSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await sendPayoutReminders();

    return NextResponse.json({
      success: true,
      message: "Payout reminders sent successfully",
    });
  } catch (error) {
    console.error("Failed to send payout reminders:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to send reminders" 
      },
      { status: 500 }
    );
  }
}
