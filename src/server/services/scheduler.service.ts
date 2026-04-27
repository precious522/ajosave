import { query } from "@/lib/db";
import { notifyPayoutReminder, notifyMissedContribution } from "./notification.service";
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
        (await query<Member>("SELECT COUNT(*) as count FROM members WHERE circle_id = $1 AND status = 'active'", [circle.id]))
          .rows[0]?.count || 0
      ).toFixed(7);

      // Send reminder to recipient
      await notifyPayoutReminder(
        recipient.userId,
        circle.name,
        totalPot,
        24
      );
    } catch (error) {
      console.error(`Failed to send payout reminder for circle ${circle.id}:`, error);
    }
  }
}

/**
 * Mark missed contributions and notify members
 * This should be called by a cron job daily
 */
export async function processMissedContributions(): Promise<void> {
  // Find active circles where the cycle has passed but not all contributions are confirmed
  const { rows: circles } = await query<Circle>(
    `SELECT * FROM circles 
     WHERE status = 'active' 
     AND next_payout_at IS NOT NULL
     AND next_payout_at < NOW()`
  );

  for (const circle of circles) {
    try {
      // Get all active members
      const { rows: members } = await query<Member>(
        "SELECT * FROM members WHERE circle_id = $1 AND status = 'active'",
        [circle.id]
      );

      // Check which members haven't contributed for the current cycle
      for (const member of members) {
        const { rows: contributions } = await query(
          `SELECT * FROM contributions 
           WHERE circle_id = $1 
           AND member_id = $2 
           AND cycle_number = $3 
           AND status = 'confirmed'`,
          [circle.id, member.id, circle.currentCycle]
        );

        // If no confirmed contribution, mark as missed
        if (contributions.length === 0) {
          // Mark member as defaulted
          await query(
            "UPDATE members SET status = 'defaulted' WHERE id = $1",
            [member.id]
          );

          // Create missed contribution record
          await query(
            `INSERT INTO contributions (id, circle_id, member_id, cycle_number, amount_usdc, status, created_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 'missed', NOW())`,
            [circle.id, member.id, circle.currentCycle, circle.contributionUsdc]
          );

          // Send notification
          await notifyMissedContribution(
            member.userId,
            circle.name,
            circle.contributionUsdc
          );
        }
      }
    } catch (error) {
      console.error(`Failed to process missed contributions for circle ${circle.id}:`, error);
    }
  }
}
