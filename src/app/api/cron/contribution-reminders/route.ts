import { NextRequest, NextResponse } from "next/server";
import { sendContributionReminders } from "@/server/services/scheduler.service";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Cron endpoint to send contribution reminders.
 *
 * Triggers the Contribution_Reminder_Service, which identifies active circle
 * members who have not yet confirmed their contribution and whose cycle deadline
 * (`next_payout_at`) falls within the 24-hour (23–25 h) or 2-hour (1–3 h)
 * reminder windows. Eligible members receive an SMS via the SMS_Notification_System.
 *
 * Schedule: Run hourly so that both reminder windows are checked at least once
 * per hour (mirrors the cadence of `/api/cron/reminders`).
 *
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const unauth = await verifyCronSecret(req);
  if (unauth) return unauth;

  try {
    await sendContributionReminders();

    return NextResponse.json({
      success: true,
      message: "Contribution reminders sent successfully",
    });
  } catch (error) {
    console.error("Failed to send contribution reminders:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send contribution reminders",
      },
      { status: 500 }
    );
  }
}
