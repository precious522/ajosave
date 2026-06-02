import { query } from "@/lib/db";
import {
  sendPayoutReminderSms,
  sendPayoutProcessedSms,
  sendMissedContributionSms,
  sendContributionReminderSms,
  sendContributionReceivedSms,
  sendJoinRequestApprovedSms,
  sendJoinRequestRejectedSms,
  sendCircleCancelledSms,
  sendCircleCancelledNoRefundSms,
  sendCirclePausedSms,
  sendCircleResumedSms,
} from "@/lib/sms";
import type { User } from "@/types";

async function canSendSms(userId: string): Promise<boolean> {
  const { rows } = await query<{ smsNotificationsEnabled: boolean }>(
    `SELECT sms_notifications_enabled as "smsNotificationsEnabled" FROM users WHERE id = $1`,
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
 * Send a contribution reminder SMS to a member before the cycle deadline.
 * Checks that the user has SMS notifications enabled and a phone number on file.
 * Logs but does not throw if the SMS delivery fails.
 */
export async function notifyContributionReminder(
  userId: string,
  circleName: string,
  amount: string,
  hoursLeft: number
): Promise<void> {
  if (!(await canSendSms(userId))) return;

  const phone = await getUserPhone(userId);
  if (!phone) return;

  try {
    await sendContributionReminderSms(phone, circleName, amount, hoursLeft);
  } catch (error) {
    console.error(`Failed to send contribution reminder to ${userId}:`, error);
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

/**
 * Notify circle creator (admin) that a member defaulted and a penalty was recorded.
 */
export async function notifyAdminOfDefault(
  adminUserId: string,
  defaulterUserId: string,
  circleName: string,
  penaltyAmount: string
): Promise<void> {
  if (!(await canSendSms(adminUserId))) return;
  const phone = await getUserPhone(adminUserId);
  if (!phone) return;

  try {
    const message = `Ajosave: A member defaulted in "${circleName}". Penalty of ${penaltyAmount} USDC recorded.`;
    await sendSms(phone, message);
  } catch (error) {
    console.error(`Failed to notify admin ${adminUserId} about default:`, error);
  }
}

/**
 * Notify all circle members when the circle completes (all payouts done)
 */
export async function notifyCircleCompleted(
  memberUserIds: string[],
  circleName: string
): Promise<void> {
  const notifications = memberUserIds.map(async (userId) => {
    if (!(await canSendSms(userId))) return;

    const phone = await getUserPhone(userId);
    if (!phone) return;

    try {
      // Reuse the payout-processed SMS with a completion message
      await sendPayoutProcessedSms(phone, circleName, "0", "everyone — the circle is complete!");
    } catch (error) {
      console.error(`Failed to send circle completion notification to ${userId}:`, error);
    }
  });

  await Promise.allSettled(notifications);
}

/**
 * Notify a member that their circle was cancelled.
 * If a refund was issued, include the amount; otherwise send a no-refund variant.
 */
export async function notifyCircleCancelled(
  userId: string,
  circleName: string,
  refundAmountUsdc: string | null
): Promise<void> {
  if (!(await canSendSms(userId))) return;

  const phone = await getUserPhone(userId);
  if (!phone) return;

  try {
    if (refundAmountUsdc) {
      await sendCircleCancelledSms(phone, circleName, refundAmountUsdc);
    } else {
      await sendCircleCancelledNoRefundSms(phone, circleName);
    }
  } catch (error) {
    console.error(`Failed to send circle cancellation notification to ${userId}:`, error);
  }
}

/**
 * Notify all circle members when the circle is paused
 */
export async function notifyCirclePaused(
  memberUserIds: string[],
  circleName: string
): Promise<void> {
  const notifications = memberUserIds.map(async (userId) => {
    if (!(await canSendSms(userId))) return;
    const phone = await getUserPhone(userId);
    if (!phone) return;
    try {
      await sendCirclePausedSms(phone, circleName);
    } catch (error) {
      console.error(`Failed to send pause notification to ${userId}:`, error);
    }
  });
  await Promise.allSettled(notifications);
}

/**
 * Notify all circle members when the circle is resumed
 */
export async function notifyCircleResumed(
  memberUserIds: string[],
  circleName: string
): Promise<void> {
  const notifications = memberUserIds.map(async (userId) => {
    if (!(await canSendSms(userId))) return;
    const phone = await getUserPhone(userId);
    if (!phone) return;
    try {
      await sendCircleResumedSms(phone, circleName);
    } catch (error) {
      console.error(`Failed to send resume notification to ${userId}:`, error);
    }
  });
  await Promise.allSettled(notifications);
}
