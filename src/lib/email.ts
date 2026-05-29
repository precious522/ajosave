/**
 * Email notification service using Resend
 * Provides transactional emails for circle activities
 */

import { Resend } from "resend";
import { serverConfig } from "@/server/config";

const resend = new Resend(serverConfig.resend.apiKey);

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a generic email
 */
export async function sendEmail(params: EmailParams): Promise<void> {
  try {
    await resend.emails.send({
      from: serverConfig.resend.fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
  } catch (error) {
    console.error("[email] Failed to send email:", error);
    throw error;
  }
}

/**
 * Send welcome email when user joins the platform
 */
export async function sendWelcomeEmail(
  email: string,
  displayName: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Ajosave!</h1>
          </div>
          <div class="content">
            <p>Hi ${displayName},</p>
            <p>Welcome to Ajosave, the trustless rotating savings platform powered by Stellar blockchain.</p>
            <p>With Ajosave, you can:</p>
            <ul>
              <li>Join or create savings circles with friends and community</li>
              <li>Make regular contributions in your preferred currency</li>
              <li>Receive payouts automatically through smart contracts</li>
              <li>Build your on-chain reputation</li>
            </ul>
            <a href="${serverConfig.app.url}/dashboard" class="button">Go to Dashboard</a>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Happy saving!</p>
            <p><strong>The Ajosave Team</strong></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Welcome to Ajosave!
    
    Hi ${displayName},
    
    Welcome to Ajosave, the trustless rotating savings platform powered by Stellar blockchain.
    
    With Ajosave, you can:
    - Join or create savings circles with friends and community
    - Make regular contributions in your preferred currency
    - Receive payouts automatically through smart contracts
    - Build your on-chain reputation
    
    Visit your dashboard: ${serverConfig.app.url}/dashboard
    
    Happy saving!
    The Ajosave Team
  `;

  await sendEmail({
    to: email,
    subject: "Welcome to Ajosave!",
    html,
    text,
  });
}

/**
 * Send email notification when user receives a payout
 */
export async function sendPayoutReceivedEmail(
  email: string,
  displayName: string,
  circleName: string,
  amount: string,
  currency: string,
  txHash: string
): Promise<void> {
  const explorerUrl = `${serverConfig.stellar.horizonUrl.replace("api", "explorer")}/tx/${txHash}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .amount { font-size: 32px; font-weight: bold; color: #10B981; text-align: center; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Payout Received!</h1>
          </div>
          <div class="content">
            <p>Hi ${displayName},</p>
            <p>Great news! You've received your payout from the <strong>${circleName}</strong> circle.</p>
            <div class="amount">${amount} ${currency}</div>
            <p>The funds have been transferred to your Stellar wallet via USDC.</p>
            <a href="${explorerUrl}" class="button">View Transaction</a>
            <p><strong>Transaction Hash:</strong><br><code style="font-size: 12px; word-break: break-all;">${txHash}</code></p>
            <p>Continue contributing to build your reputation and unlock more opportunities!</p>
            <p><strong>The Ajosave Team</strong></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Payout Received!
    
    Hi ${displayName},
    
    Great news! You've received your payout from the ${circleName} circle.
    
    Amount: ${amount} ${currency}
    
    The funds have been transferred to your Stellar wallet via USDC.
    
    Transaction Hash: ${txHash}
    View on Explorer: ${explorerUrl}
    
    Continue contributing to build your reputation and unlock more opportunities!
    
    The Ajosave Team
  `;

  await sendEmail({
    to: email,
    subject: `Payout Received: ${amount} ${currency}`,
    html,
    text,
  });
}

/**
 * Send contribution reminder email
 */
export async function sendContributionReminderEmail(
  email: string,
  displayName: string,
  circleName: string,
  amount: string,
  currency: string,
  dueDate: Date
): Promise<void> {
  const formattedDate = dueDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #F59E0B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .amount { font-size: 24px; font-weight: bold; color: #F59E0B; text-align: center; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Contribution Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${displayName},</p>
            <p>This is a friendly reminder that your contribution for the <strong>${circleName}</strong> circle is due soon.</p>
            <div class="amount">${amount} ${currency}</div>
            <p><strong>Due Date:</strong> ${formattedDate}</p>
            <p>Making your contribution on time helps maintain your reputation score and keeps the circle running smoothly for everyone.</p>
            <a href="${serverConfig.app.url}/circles" class="button">Make Contribution</a>
            <p>Thank you for being a reliable member!</p>
            <p><strong>The Ajosave Team</strong></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Contribution Reminder
    
    Hi ${displayName},
    
    This is a friendly reminder that your contribution for the ${circleName} circle is due soon.
    
    Amount: ${amount} ${currency}
    Due Date: ${formattedDate}
    
    Making your contribution on time helps maintain your reputation score and keeps the circle running smoothly for everyone.
    
    Make your contribution: ${serverConfig.app.url}/circles
    
    Thank you for being a reliable member!
    
    The Ajosave Team
  `;

  await sendEmail({
    to: email,
    subject: `Reminder: ${amount} ${currency} contribution due for ${circleName}`,
    html,
    text,
  });
}

/**
 * Send email when a circle is completed
 */
export async function sendCircleCompletedEmail(
  email: string,
  displayName: string,
  circleName: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎊 Circle Completed!</h1>
          </div>
          <div class="content">
            <p>Hi ${displayName},</p>
            <p>Congratulations! The <strong>${circleName}</strong> circle has been successfully completed.</p>
            <p>All members have received their payouts, and your reputation has been updated based on your participation.</p>
            <p>Thank you for being a committed member. Your on-time contributions help build trust in the community.</p>
            <a href="${serverConfig.app.url}/circles" class="button">Join Another Circle</a>
            <p>Ready to start another savings journey?</p>
            <p><strong>The Ajosave Team</strong></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Circle Completed!
    
    Hi ${displayName},
    
    Congratulations! The ${circleName} circle has been successfully completed.
    
    All members have received their payouts, and your reputation has been updated based on your participation.
    
    Thank you for being a committed member. Your on-time contributions help build trust in the community.
    
    Join another circle: ${serverConfig.app.url}/circles
    
    Ready to start another savings journey?
    
    The Ajosave Team
  `;

  await sendEmail({
    to: email,
    subject: `Circle Completed: ${circleName}`,
    html,
    text,
  });
}
