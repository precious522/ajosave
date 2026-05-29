import { query, transaction } from "@/lib/db";
import { sendUsdcPayment, validateStellarRecipient } from "@/lib/stellar";
import { invokeContractPayout } from "@/lib/soroban";
import { getCircleById, getMembersByCircle, updateCircleStatus } from "./circle.service";
import { withPayoutLock, PayoutLockError } from "./payout-lock";
import { notifyPayoutProcessed, notifyCircleCompleted } from "./notification.service";
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
    // Only count active members (exclude defaulted) for the pot
    const activeMembers = circleMembers.filter((m) => m.status === "active");
    const totalPot = (
      parseFloat(circle.contributionUsdc) * activeMembers.length
    ).toFixed(7);

    // Guard: reject if the current cycle's recipient already received a payout
    const recipientMemberForGuard = circleMembers[circle.currentCycle - 1];
    if (recipientMemberForGuard?.hasReceivedPayout) {
      throw new Error(`Member has already received payout for cycle ${circle.currentCycle}`);
    }

    let txHash: string;
    if (circle.contractId) {
      // Soroban path: contract handles transfer, backend only triggers payout()
      txHash = await invokeContractPayout(circle.contractId);
    } else {
      // Horizon fallback: validate key, account existence, and USDC trustline first
      await validateStellarRecipient(recipientStellarKey);
      txHash = await sendUsdcPayment(recipientStellarKey, totalPot);
    }

    const payoutId = randomUUID();
    const recipientMember = circleMembers[circle.currentCycle - 1];
    const recipientMemberId = recipientMember?.id ?? "";

    // Atomically persist the payout record and mark the member as paid.
    // The UNIQUE constraint on (circle_id, cycle_number) provides a second
    // layer of idempotency at the database level — a duplicate call for the
    // same cycle will fail with a unique-violation error before any money moves.
    let payout: Payout;
    try {
      payout = await transaction(async (q) => {
        const { rows } = await q<Payout>(
          `INSERT INTO payouts (id, circle_id, recipient_member_id, cycle_number, amount_usdc, tx_hash, paid_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING id, circle_id as "circleId", recipient_member_id as "recipientMemberId",
                     cycle_number as "cycleNumber", amount_usdc as "amountUsdc", tx_hash as "txHash", paid_at as "paidAt"`,
          [payoutId, circleId, recipientMemberId, circle.currentCycle, totalPot, txHash]
        );

        // Mark recipient as having received their payout within the same transaction
        // so the flag is always consistent with the payout record.
        if (recipientMemberId) {
          await q(
            "UPDATE members SET has_received_payout = TRUE, updated_at = NOW() WHERE id = $1",
            [recipientMemberId]
          );
        }

        return rows[0];
      });
    } catch (err: unknown) {
      // Surface duplicate-cycle violations as a clean application error
      const pg = err as { code?: string };
      if (pg.code === "23505") {
        throw new Error(`Payout for cycle ${circle.currentCycle} has already been processed`);
      }
      throw err;
    }

    // Send SMS notifications to all members (async, non-blocking)
    if (recipientMember) {
      const memberUserIds = circleMembers.map(m => m.userId);
      const { rows: recipientUser } = await query<{ display_name: string }>(
        "SELECT display_name FROM users WHERE id = $1",
        [recipientMember.userId]
      );
      const recipientName = recipientUser[0]?.display_name ?? "Member";

      notifyPayoutProcessed(memberUserIds, circle.name, totalPot, recipientName).catch(err => {
        console.error("Failed to send payout notifications:", err);
      });
    }

    if (circle.currentCycle >= circleMembers.length) {
      await updateCircleStatus(circleId, "completed");

      // Send completion notifications to all members (async, non-blocking)
      const memberUserIds = circleMembers.map(m => m.userId);
      notifyCircleCompleted(memberUserIds, circle.name).catch((err) =>
        console.error("[payout] Failed to send completion notifications:", err)
      );
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
