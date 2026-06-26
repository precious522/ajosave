import { query } from "./db";

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Send push notification to a user
 */
export async function sendPushNotificationToUser(
  userId: string,
  notification: PushNotification
): Promise<void> {
  // Get all push tokens for the user
  const { rows } = await query<{ token: string; platform: "ios" | "android" | "web" }>(
    `SELECT token, platform FROM push_tokens WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    console.log(`[push] No push tokens found for user ${userId}`);
    return;
  }

  // Send to each token
  const promises = rows.map(async (row) => {
    try {
      await sendPushNotification(row.token, row.platform, notification);
    } catch (error) {
      console.error(`[push] Failed to send to token ${row.token}:`, error);
    }
  });

  await Promise.allSettled(promises);
}

/**
 * Send push notification to a specific token
 * TODO: Implement actual push service integration (FCM, APNs, OneSignal, etc.)
 */
async function sendPushNotification(
  token: string,
  platform: string,
  notification: PushNotification
): Promise<void> {
  // For now, just log the notification
  console.log(`[push] Sending to ${platform} token ${token}:`, notification);
  // TODO: Add actual push service integration here
}

/**
 * Send contribution reminder push notification
 */
export async function sendContributionReminderPush(
  userId: string,
  circleName: string,
  amount: string,
  hoursLeft: number,
  circleId: string
): Promise<void> {
  await sendPushNotificationToUser(userId, {
    title: `Contribution Reminder: ${circleName}`,
    body: `Your contribution of ${amount} USDC is due in ${hoursLeft} hours!`,
    data: {
      type: "contribution-reminder",
      circleId,
    },
  });
}
