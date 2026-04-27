import { query } from "@/lib/db";
import {
  sendPayoutReminderSms,
  sendPayoutProcessedSms,
  sendMissedContributionSms,
  sendContributionReceivedSms,
  sendJoinRequestApprovedSms,
  sendJoinRequestRejectedSms,
} from "@/lib/sms";
import type { User } from "@/types";

/**
 * Check if user has SMS notifications enabled
 */
async function canSendSms(userId: string): Promise<boolean> {
  const { rows } = await query<User>(
    "SELECT sms_notifications_enabled FROM users WHERE id = $1",
    [userId]
  );
  return rows[0]?.smsNotificationsEnabled ?? false;
}

/**
 * Get user phone number
 */
async function getUserPhone(userId: string): Promise<string | null> {
  const { rows } = await query<User>(
    "SELECT phone FROM users WHERE id = $1",
    [userId]
  );
  return rows[0]?.phone ?? null;
}

/**
 * Send payout reminder 24 hours before payout
 */
export async function notifyPayoutReminder(
  userId: string,
  circleName: string,
  amount: string,
  hoursUntilPayout: number = 24
): Promise<void> {
  if (!(await canSendSms(userId))) return;
  
  const phone = await getUserPhone(userId);
  if (!phone) return;

  try {
    await sendPayoutReminderSms(phone, circleName, amount, hoursUntilPayout);
  } catch (error) {
    console.error(`Failed to send payout reminder to ${userId}:`, error);
  }
}

/**
 * Notify all circle members when a payout is processed
 */
export async function notifyPayoutProcessed(
  memberUserIds: string[],
  circleName: string,
  amount: string,
  recipientName: string
): Promise<void> {
  const notifications = memberUserIds.map(async (userId) => {
    if (!(await canSendSms(userId))) return;
    
    const phone = await getUserPhone(userId);
    if (!phone) return;

    try {
      await sendPayoutProcessedSms(phone, circleName, amount, recipientName);
    } catch (error) {
      console.error(`Failed to send payout notification to ${userId}:`, error);
    }
  });

  await Promise.allSettled(notifications);
}

/**
 * Notify member when they miss a contribution
 */
export async function notifyMissedContribution(
  userId: string,
  circleName: string,
  amount: string
): Promise<void> {
  if (!(await canSendSms(userId))) return;
  
  const phone = await getUserPhone(userId);
  if (!phone) return;

  try {
    await sendMissedContributionSms(phone, circleName, amount);
  } catch (error) {
    console.error(`Failed to send missed contribution notification to ${userId}:`, error);
  }
}

/**
 * Notify member when their contribution is confirmed
 */
export async function notifyContributionReceived(
  userId: string,
  circleName: string,
  amount: string,
  cycleNumber: number
): Promise<void> {
  if (!(await canSendSms(userId))) return;
  
  const phone = await getUserPhone(userId);
  if (!phone) return;

  try {
    await sendContributionReceivedSms(phone, circleName, amount, cycleNumber);
  } catch (error) {
    console.error(`Failed to send contribution confirmation to ${userId}:`, error);
  }
}

/**
 * Notify member when their join request is approved
 */
export async function notifyJoinRequestApproved(
  userId: string,
  circleName: string
): Promise<void> {
  if (!(await canSendSms(userId))) return;
  
  const phone = await getUserPhone(userId);
  if (!phone) return;

  try {
    await sendJoinRequestApprovedSms(phone, circleName);
  } catch (error) {
    console.error(`Failed to send join approval notification to ${userId}:`, error);
  }
}

/**
 * Notify member when their join request is rejected
 */
export async function notifyJoinRequestRejected(
  userId: string,
  circleName: string
): Promise<void> {
  if (!(await canSendSms(userId))) return;
  
  const phone = await getUserPhone(userId);
  if (!phone) return;

  try {
    await sendJoinRequestRejectedSms(phone, circleName);
  } catch (error) {
    console.error(`Failed to send join rejection notification to ${userId}:`, error);
  }
}

/**
 * Toggle SMS notifications for a user
 */
export async function toggleSmsNotifications(
  userId: string,
  enabled: boolean
): Promise<void> {
  await query(
    "UPDATE users SET sms_notifications_enabled = $1 WHERE id = $2",
    [enabled, userId]
  );
}
