import axios from "axios";
import { serverConfig } from "@/server/config";
import { getCorrelationId } from "./correlation";
import { getDb } from "./db";

const client = axios.create({ baseURL: "https://api.ng.termii.com/api" });

client.interceptors.request.use((config) => {
  const correlationId = getCorrelationId();
  if (correlationId) config.headers["x-correlation-id"] = correlationId;
  return config;
});

async function logSms(phone: string, message: string, messageId: string | null): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO sms_logs (phone, message, message_id, status)
     VALUES ($1, $2, $3, 'pending')`,
    [phone, message, messageId]
  );
}

export async function sendOtp(phone: string): Promise<string> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const message = `Your Ajosave verification code is: ${otp}. Valid for 10 minutes.`;
  const res = await client.post("/sms/send", {
    to: phone,
    from: serverConfig.termii.senderId,
    sms: message,
    type: "plain",
    channel: "generic",
    api_key: serverConfig.termii.apiKey,
  });
  await logSms(phone, message, res.data?.message_id ?? null);
  return otp;
}

export async function sendSms(phone: string, message: string): Promise<void> {
  const res = await client.post("/sms/send", {
    to: phone,
    from: serverConfig.termii.senderId,
    sms: message,
    type: "plain",
    channel: "generic",
    api_key: serverConfig.termii.apiKey,
  });
  await logSms(phone, message, res.data?.message_id ?? null);
}

export async function sendPayoutReminderSms(
  phone: string,
  circleName: string,
  amount: string,
  hoursUntilPayout: number
): Promise<void> {
  const message = `Ajosave: Your payout of ${amount} USDC from "${circleName}" will be processed in ${hoursUntilPayout} hours. Make sure your Stellar wallet is ready!`;
  await sendSms(phone, message);
}

export async function sendPayoutProcessedSms(
  phone: string,
  circleName: string,
  amount: string,
  recipientName: string
): Promise<void> {
  const message = `Ajosave: Payout of ${amount} USDC processed for ${recipientName} in "${circleName}". Check your circle dashboard for details.`;
  await sendSms(phone, message);
}

export async function sendMissedContributionSms(
  phone: string,
  circleName: string,
  amount: string
): Promise<void> {
  const message = `Ajosave: You missed your contribution of ${amount} USDC to "${circleName}". Your status is now "defaulted" and you cannot receive future payouts. Contact support if this is an error.`;
  await sendSms(phone, message);
}

export async function sendContributionReminderSms(
  phone: string,
  circleName: string,
  amount: string,
  hoursLeft: number
): Promise<void> {
  const message = `Ajosave: Your contribution of ${amount} USDC to "${circleName}" is due in ${hoursLeft} hours. Please contribute now to avoid being marked as defaulted!`;
  await sendSms(phone, message);
}

export async function sendContributionReceivedSms(
  phone: string,
  circleName: string,
  amount: string,
  cycleNumber: number
): Promise<void> {
  const message = `Ajosave: Your contribution of ${amount} USDC to "${circleName}" (Cycle ${cycleNumber}) has been confirmed. Thank you!`;
  await sendSms(phone, message);
}

export async function sendJoinRequestApprovedSms(
  phone: string,
  circleName: string
): Promise<void> {
  const message = `Ajosave: Your join request for "${circleName}" has been approved! You'll be notified when the circle starts.`;
  await sendSms(phone, message);
}

export async function sendJoinRequestRejectedSms(
  phone: string,
  circleName: string
): Promise<void> {
  const message = `Ajosave: Your join request for "${circleName}" has been declined by the creator.`;
  await sendSms(phone, message);
}

export async function sendCircleCancelledSms(
  phone: string,
  circleName: string,
  refundAmount: string
): Promise<void> {
  const message = `Ajosave: The circle "${circleName}" has been cancelled by the creator. A refund of ${refundAmount} USDC has been sent to your Stellar wallet.`;
  await sendSms(phone, message);
}

export async function sendCircleCancelledNoRefundSms(
  phone: string,
  circleName: string
): Promise<void> {
  const message = `Ajosave: The circle "${circleName}" has been cancelled by the creator. You had no confirmed contributions, so no refund is needed.`;
  await sendSms(phone, message);
}

export async function sendCirclePausedSms(
  phone: string,
  circleName: string
): Promise<void> {
  const message = `Ajosave: The circle "${circleName}" has been paused by the creator. Future payouts are temporarily suspended. You'll be notified when it resumes.`;
  await sendSms(phone, message);
}

export async function sendCircleResumedSms(
  phone: string,
  circleName: string
): Promise<void> {
  const message = `Ajosave: The circle "${circleName}" has been resumed. Normal schedule and payouts have been restored.`;
  await sendSms(phone, message);
}
