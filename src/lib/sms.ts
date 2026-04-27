import axios from "axios";
import { serverConfig } from "@/server/config";

const client = axios.create({ baseURL: "https://api.ng.termii.com/api" });

export async function sendOtp(phone: string): Promise<string> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await client.post("/sms/send", {
    to: phone,
    from: serverConfig.termii.senderId,
    sms: `Your Ajosave verification code is: ${otp}. Valid for 10 minutes.`,
    type: "plain",
    channel: "generic",
    api_key: serverConfig.termii.apiKey,
  });
  return otp;
}

export async function sendSms(phone: string, message: string): Promise<void> {
  await client.post("/sms/send", {
    to: phone,
    from: serverConfig.termii.senderId,
    sms: message,
    type: "plain",
    channel: "generic",
    api_key: serverConfig.termii.apiKey,
  });
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
