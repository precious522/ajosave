/**
 * Stellar Horizon streaming service
 * Monitors incoming USDC payments in real-time using Server-Sent Events (SSE)
 */

import { horizonServer, USDC } from "@/lib/stellar";
import { serverConfig } from "@/server/config";
import { query } from "@/lib/db";
import { Keypair } from "@stellar/stellar-sdk";
import type { ServerApi } from "@stellar/stellar-sdk/lib/horizon";

interface PaymentHandler {
  (payment: ServerApi.PaymentOperationRecord): Promise<void>;
}

let streamCloser: (() => void) | null = null;

/**
 * Start streaming payments to the platform account
 * Automatically confirms contributions when USDC is received
 */
export async function startHorizonStream(onPayment?: PaymentHandler): Promise<void> {
  if (streamCloser) {
    console.warn("[horizon-stream] Stream already running");
    return;
  }

  const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const platformAccount = keypair.publicKey();

  console.log(`[horizon-stream] Starting payment stream for ${platformAccount}`);

  // Stream payments to the platform account
  const paymentsStream = horizonServer
    .payments()
    .forAccount(platformAccount)
    .cursor("now") // Start from current ledger
    .stream({
      onmessage: async (payment) => {
        try {
          // Only process payment operations (not path payments or other types)
          if (payment.type !== "payment") return;

          const paymentOp = payment as ServerApi.PaymentOperationRecord;

          // Only process USDC payments
          if (
            paymentOp.asset_type === "native" ||
            paymentOp.asset_code !== USDC.code ||
            paymentOp.asset_issuer !== USDC.issuer
          ) {
            return;
          }

          // Only process incoming payments (to platform account)
          if (paymentOp.to !== platformAccount) return;

          console.log(`[horizon-stream] Received USDC payment:`, {
            from: paymentOp.from,
            amount: paymentOp.amount,
            txHash: paymentOp.transaction_hash,
          });

          // Call custom handler if provided
          if (onPayment) {
            await onPayment(paymentOp);
          }

          // Auto-confirm contribution if this payment matches a pending contribution
          await autoConfirmContribution(paymentOp);
        } catch (error) {
          console.error("[horizon-stream] Error processing payment:", error);
        }
      },
      onerror: (error) => {
        console.error("[horizon-stream] Stream error:", error);
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          console.log("[horizon-stream] Attempting to reconnect...");
          stopHorizonStream();
          startHorizonStream(onPayment);
        }, 5000);
      },
    });

  streamCloser = () => paymentsStream();
}

/**
 * Stop the Horizon payment stream
 */
export function stopHorizonStream(): void {
  if (streamCloser) {
    console.log("[horizon-stream] Stopping payment stream");
    streamCloser();
    streamCloser = null;
  }
}

/**
 * Auto-confirm a contribution when matching USDC payment is received
 * Matches based on amount and timing
 */
async function autoConfirmContribution(payment: ServerApi.PaymentOperationRecord): Promise<void> {
  const amountUsdc = payment.amount;
  const txHash = payment.transaction_hash;
  const senderAddress = payment.from;

  // Find pending contributions that match this payment amount
  // Look for contributions created in the last 30 minutes
  const { rows } = await query<{
    id: string;
    circle_id: string;
    member_id: string;
    user_id: string;
    stellar_public_key: string;
  }>(
    `SELECT c.id, c.circle_id, c.member_id, m.user_id, u.stellar_public_key
     FROM contributions c
     JOIN members m ON m.id = c.member_id
     JOIN users u ON u.id = m.user_id
     WHERE c.status = 'pending'
       AND c.amount_usdc = $1
       AND c.created_at > NOW() - INTERVAL '30 minutes'
       AND u.stellar_public_key = $2
     ORDER BY c.created_at DESC
     LIMIT 1`,
    [amountUsdc, senderAddress]
  );

  if (rows.length === 0) {
    console.log(
      `[horizon-stream] No matching pending contribution found for ${amountUsdc} USDC from ${senderAddress}`
    );
    return;
  }

  const contribution = rows[0];

  // Update contribution status to confirmed
  await query(
    `UPDATE contributions
     SET status = 'confirmed', tx_hash = $1
     WHERE id = $2`,
    [txHash, contribution.id]
  );

  // Increment user's reputation score for on-time contribution
  const { incrementReputationOnContribution } = await import("./reputation.service");
  await incrementReputationOnContribution(contribution.user_id);

  console.log(`[horizon-stream] Auto-confirmed contribution ${contribution.id}`);

  // Emit event for real-time updates (WebSocket broadcast)
  await broadcastContributionConfirmed(contribution.circle_id, contribution.member_id, txHash);
}

/**
 * Broadcast contribution confirmation to WebSocket clients
 */
async function broadcastContributionConfirmed(
  circleId: string,
  memberId: string,
  txHash: string
): Promise<void> {
  const { broadcastContributionConfirmed: broadcast } = await import("../websocket");
  broadcast(circleId, memberId, txHash);
}

/**
 * Get stream status
 */
export function getStreamStatus(): { running: boolean } {
  return { running: streamCloser !== null };
}
