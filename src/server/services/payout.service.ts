import { query } from "@/lib/db";
import { sendUsdcPayment } from "@/lib/stellar";
import { invokeContractPayout } from "@/lib/soroban";
import { getCircleById, getMembersByCircle, updateCircleStatus } from "./circle.service";
import { withPayoutLock, PayoutLockError } from "./payout-lock";
import { notifyPayoutProcessed } from "./notification.service";
import type { Payout } from "@/types";
import { randomUUID } from "crypto";

export { PayoutLockError };

/**
 * Process a payout cycle for a circle.
 *
 * If the circle has a contractId, the Soroban contract is the source of truth:
 * it handles the token transfer and rotation internally.
 *
 * Falls back to direct Horizon payment for circles without a deployed contract.
 *
 * All payout records are persisted to PostgreSQL for horizontal scalability.
 */
export async function processCyclePayout(
  circleId: string,
  recipientStellarKey: string
): Promise<Payout> {
  return withPayoutLock(circleId, async () => {
    const circle = await getCircleById(circleId);
    if (!circle) throw new Error("Circle not found");
    if (circle.status !== "active") throw new Error("Circle is not active");

    const circleMembers = await getMembersByCircle(circleId);
    const totalPot = (
      parseFloat(circle.contributionUsdc) * circleMembers.length
    ).toFixed(7);

    let txHash: string;
    if (circle.contractId) {
      // Soroban path: contract handles transfer, backend only triggers payout()
      txHash = await invokeContractPayout(circle.contractId);
    } else {
      // Horizon fallback for circles without a deployed contract
      txHash = await sendUsdcPayment(recipientStellarKey, totalPot);
    }

    const payoutId = randomUUID();
    const recipientMember = circleMembers[circle.currentCycle - 1];
    const recipientMemberId = recipientMember?.id ?? "";

    // Persist payout to PostgreSQL
    const { rows } = await query<Payout>(
      `INSERT INTO payouts (id, circle_id, recipient_member_id, cycle_number, amount_usdc, tx_hash, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, circle_id as "circleId", recipient_member_id as "recipientMemberId", 
                 cycle_number as "cycleNumber", amount_usdc as "amountUsdc", tx_hash as "txHash", paid_at as "paidAt"`,
      [payoutId, circleId, recipientMemberId, circle.currentCycle, totalPot, txHash]
    );

    const payout = rows[0];

    // Send SMS notifications to all members
    if (recipientMember) {
      const memberUserIds = circleMembers.map(m => m.userId);
      const { rows: recipientUser } = await query<{ display_name: string }>(
        "SELECT display_name FROM users WHERE id = $1",
        [recipientMember.userId]
      );
      const recipientName = recipientUser[0]?.display_name ?? "Member";
      
      // Notify all members about the payout (async, don't block)
      notifyPayoutProcessed(memberUserIds, circle.name, totalPot, recipientName).catch(err => {
        console.error("Failed to send payout notifications:", err);
      });
    }

    if (circle.currentCycle >= circleMembers.length) {
      await updateCircleStatus(circleId, "completed");
    }

    return payout;
  }); // end withPayoutLock
}

/**
 * Retrieve all payouts for a specific circle from PostgreSQL.
 * @param circleId The circle ID to filter payouts by
 * @returns Array of payout records sorted by cycle number
 */
export async function getPayoutsByCircle(circleId: string): Promise<Payout[]> {
  const { rows } = await query<Payout>(
    `SELECT id, circle_id as "circleId", recipient_member_id as "recipientMemberId",
            cycle_number as "cycleNumber", amount_usdc as "amountUsdc", tx_hash as "txHash", paid_at as "paidAt"
     FROM payouts
     WHERE circle_id = $1
     ORDER BY cycle_number ASC`,
    [circleId]
  );
  return rows;
}
