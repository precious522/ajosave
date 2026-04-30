import { query } from "@/lib/db";
import {
  notifyPayoutReminder,
  notifyMissedContribution,
  notifyContributionReminder,
} from "./notification.service";
import { getMissedContributions } from "./contribution.service";
import type { Circle, Member } from "@/types";

/**
 * Send payout reminders 24 hours before scheduled payouts
 * This should be called by a cron job every hour
 */
export async function sendPayoutReminders(): Promise<void> {
  // Find circles with payouts due in 23-25 hours
  const { rows: circles } = await query<Circle>(
    `SELECT * FROM circles 
     WHERE status = 'active' 
     AND next_payout_at IS NOT NULL
     AND next_payout_at > NOW() + INTERVAL '23 hours'
     AND next_payout_at < NOW() + INTERVAL '25 hours'`
  );

  for (const circle of circles) {
    try {
      // Get the member who will receive the next payout
      const { rows: members } = await query<Member>(
        `SELECT * FROM members 
         WHERE circle_id = $1 
         AND position = $2 
         AND status = 'active'`,
        [circle.id, circle.currentCycle]
      );

      const recipient = members[0];
      if (!recipient) continue;

      const totalPot = (
        parseFloat(circle.contributionUsdc) *
          (
            await query<Member>(
              "SELECT COUNT(*) as count FROM members WHERE circle_id = $1 AND status = 'active'",
              [circle.id]
            )
          ).rows[0]?.count || 0
      ).toFixed(7);

      // Send reminder to recipient
      await notifyPayoutReminder(recipient.userId, circle.name, totalPot, 24);
    } catch (error) {
      console.error(`Failed to send payout reminder for circle ${circle.id}:`, error);
    }
  }
}

/**
 * Mark missed contributions and notify members after the grace period.
 * Grace period is configurable per circle (grace_period_hours after next_payout_at).
 * This should be called by a cron job daily.
 */
export async function processMissedContributions(): Promise<void> {
  // Find active circles where the grace period has elapsed
  const { rows: circles } = await query<Circle & { gracePeriodHours: number }>(
    `SELECT *, grace_period_hours as "gracePeriodHours" FROM circles 
     WHERE status = 'active' 
     AND next_payout_at IS NOT NULL
     AND next_payout_at + (grace_period_hours * INTERVAL '1 hour') < NOW()`
  );

  for (const circle of circles) {
    try {
      const missed = await getMissedContributions(circle.id, circle.currentCycle);

      for (const { memberId, userId } of missed) {
        // Mark member as defaulted
        await query("UPDATE members SET status = 'defaulted' WHERE id = $1", [memberId]);

        // Create missed contribution record
        await query(
          `INSERT INTO contributions (id, circle_id, member_id, cycle_number, amount_usdc, status, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'missed', NOW())
           ON CONFLICT (member_id, cycle_number) DO NOTHING`,
          [circle.id, memberId, circle.currentCycle, circle.contributionUsdc]
        );

        // Decrement reputation score (floor at 0)
        await query(
          `UPDATE users SET reputation_score = GREATEST(0, reputation_score - 10) WHERE id = $1`,
          [userId]
        );

        // Send notification
        await notifyMissedContribution(userId, circle.name, circle.contributionUsdc);
      }
    } catch (error) {
      console.error(`Failed to process missed contributions for circle ${circle.id}:`, error);
    }
  }
}

type ReminderWindow = { hoursLeft: number; lowerBound: string; upperBound: string };

const WINDOWS: ReminderWindow[] = [
  { hoursLeft: 24, lowerBound: "23 hours", upperBound: "25 hours" },
  { hoursLeft: 2, lowerBound: "1 hour", upperBound: "3 hours" },
];

/**
 * Send contribution reminders for both the 24h and 2h windows.
 * Idempotent: uses the contribution_reminders table to prevent duplicates.
 * Per-circle errors are caught and logged; they do not abort the run.
 */
export async function sendContributionReminders(): Promise<void> {
  for (const { hoursLeft, lowerBound, upperBound } of WINDOWS) {
    const reminderType = `${hoursLeft}h`;

    const { rows: circles } = await query<Circle>(
      `SELECT id, name, status, next_payout_at as "nextPayoutAt",
              current_cycle as "currentCycle", contribution_usdc as "contributionUsdc"
       FROM circles
       WHERE status = 'active'
         AND next_payout_at IS NOT NULL
         AND next_payout_at > NOW() + INTERVAL '${lowerBound}'
         AND next_payout_at < NOW() + INTERVAL '${upperBound}'`
    );

    for (const circle of circles) {
      try {
        const { rows: members } = await query<{ id: string; userId: string }>(
          `SELECT m.id, m.user_id as "userId"
           FROM members m
           WHERE m.circle_id = $1
             AND m.status = 'active'`,
          [circle.id]
        );

        for (const member of members) {
          // Check if member has already confirmed their contribution for this cycle
          const { rows: confirmedRows } = await query(
            `SELECT 1 FROM contributions
             WHERE member_id = $1
               AND circle_id = $2
               AND cycle_number = $3
               AND status = 'confirmed'`,
            [member.id, circle.id, circle.currentCycle]
          );
          if (confirmedRows.length > 0) continue; // already confirmed — not a Pending_Contributor

          // Check if contribution is 'missed' — also not a Pending_Contributor
          const { rows: statusRows } = await query<{ status: string }>(
            `SELECT status FROM contributions
             WHERE member_id = $1
               AND circle_id = $2
               AND cycle_number = $3`,
            [member.id, circle.id, circle.currentCycle]
          );
          if (statusRows.length > 0 && statusRows[0].status === "missed") continue;

          // Check idempotency — has this reminder already been sent?
          const { rows: reminderRows } = await query(
            `SELECT 1 FROM contribution_reminders
             WHERE member_id = $1
               AND cycle_number = $2
               AND reminder_type = $3`,
            [member.id, circle.currentCycle, reminderType]
          );
          if (reminderRows.length > 0) continue; // already reminded this window/cycle

          // Send the reminder
          await notifyContributionReminder(
            member.userId,
            circle.name,
            circle.contributionUsdc,
            hoursLeft
          );

          // Record that we sent the reminder (idempotency insert)
          await query(
            `INSERT INTO contribution_reminders (id, member_id, cycle_number, reminder_type, sent_at)
             VALUES (gen_random_uuid(), $1, $2, $3, NOW())
             ON CONFLICT DO NOTHING`,
            [member.id, circle.currentCycle, reminderType]
          );
        }
      } catch (error) {
        console.error(`Failed to send contribution reminders for circle ${circle.id}:`, error);
      }
    }
  }
}
