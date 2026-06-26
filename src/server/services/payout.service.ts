import { query, transaction } from "@/lib/db";
import { sendUsdcPayment, validateStellarRecipient } from "@/lib/stellar";
import { invokeContractPayout } from "@/lib/soroban";
import { getCircleById, getMembersByCircle, updateCircleStatus } from "./circle.service";
import { withPayoutLock, PayoutLockError } from "./payout-lock";
import { notifyPayoutProcessed, notifyCircleCompleted } from "./notification.service";
import { mintCertificate } from "./certificate.service";
import type { Payout } from "@/types";
import { randomUUID } from "crypto";
import logger from "@/lib/logger";

export { PayoutLockError };

const PAYOUT_MAX_RETRIES = 3;
const RETRY_DELAY_MS = [5_000, 15_000, 45_000];

async function alertAdmin(circleId: string, cycle: number, error: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `🚨 Payout failed after all retries — circle: ${circleId}, cycle: ${cycle}\nError: ${error}` }),
    });
  } catch (e) {
    logger.error({ e }, "[payout] Failed to send admin alert");
  }
}

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
    const activeMembers = circleMembers.filter((m) => m.status === "active");
    const totalPot = (
      parseFloat(circle.contributionUsdc) * activeMembers.length
    ).toFixed(7);

    const recipientMemberForGuard = circleMembers[circle.currentCycle - 1];
    if (recipientMemberForGuard?.hasReceivedPayout) {
      throw new Error(`Member has already received payout for cycle ${circle.currentCycle}`);
    }

    const payoutId = randomUUID();
    const recipientMember = circleMembers[circle.currentCycle - 1];
    const recipientMemberId = recipientMember?.id ?? "";

    // Insert payout record as 'pending' before attempting
    await query(
      `INSERT INTO payouts (id, circle_id, recipient_member_id, cycle_number, amount_usdc, tx_hash, status, retry_count, paid_at)
       VALUES ($1, $2, $3, $4, $5, '', 'pending', 0, NOW())
       ON CONFLICT (circle_id, cycle_number) DO NOTHING`,
      [payoutId, circleId, recipientMemberId, circle.currentCycle, totalPot]
    );

    // Fetch the actual record (handles idempotency if already inserted)
    const { rows: existingRows } = await query<Payout & { status: string; retry_count: number }>(
      `SELECT id, status, retry_count FROM payouts WHERE circle_id = $1 AND cycle_number = $2`,
      [circleId, circle.currentCycle]
    );
    const existingPayout = existingRows[0];
    if (existingPayout?.status === "completed") {
      throw new Error(`Payout for cycle ${circle.currentCycle} has already been processed`);
    }

    const currentRetry = existingPayout?.retry_count ?? 0;
    let txHash: string;
    let lastError = "";

    for (let attempt = 0; attempt <= PAYOUT_MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS[attempt - 1]));
      }
      try {
        if (circle.contractId) {
          txHash = await invokeContractPayout(circle.contractId);
        } else {
          await validateStellarRecipient(recipientStellarKey);
          txHash = await sendUsdcPayment(recipientStellarKey, totalPot);
        }
        lastError = "";
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn({ err, attempt, circleId }, `[payout] attempt ${attempt + 1} failed`);
        await query(
          `UPDATE payouts SET status = 'processing', retry_count = $1, last_error = $2 WHERE circle_id = $3 AND cycle_number = $4`,
          [currentRetry + attempt + 1, lastError, circleId, circle.currentCycle]
        );
        if (attempt === PAYOUT_MAX_RETRIES) {
          await query(
            `UPDATE payouts SET status = 'failed' WHERE circle_id = $1 AND cycle_number = $2`,
            [circleId, circle.currentCycle]
          );
          await alertAdmin(circleId, circle.currentCycle, lastError);
          throw err;
        }
      }
    }

    let payout: Payout;
    try {
      payout = await transaction(async (q) => {
        const { rows } = await q<Payout>(
          `UPDATE payouts
           SET tx_hash = $1, status = 'completed', paid_at = NOW()
           WHERE circle_id = $2 AND cycle_number = $3
           RETURNING id, circle_id as "circleId", recipient_member_id as "recipientMemberId",
                     cycle_number as "cycleNumber", amount_usdc as "amountUsdc", tx_hash as "txHash", paid_at as "paidAt"`,
          [txHash!, circleId, circle.currentCycle]
        );

        if (recipientMemberId) {
          await q(
            "UPDATE members SET has_received_payout = TRUE, updated_at = NOW() WHERE id = $1",
            [recipientMemberId]
          );
        }

        return rows[0];
      });
    } catch (err: unknown) {
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

      // Mint completion certificates for all active members (async, non-blocking)
      const totalSavedUsdc = (
        parseFloat(circle.contributionUsdc) * activeMembers.length * circleMembers.length
      ).toFixed(7);

      const { rows: memberUsers } = await query<{ stellar_public_key: string | null }>(
        `SELECT u.stellar_public_key FROM members m
         JOIN users u ON u.id = m.user_id
         WHERE m.circle_id = $1 AND m.status = 'active'`,
        [circleId]
      );

      for (const { stellar_public_key } of memberUsers) {
        if (!stellar_public_key) continue;
        mintCertificate({
          memberStellarKey: stellar_public_key,
          circleId,
          circleName: circle.name,
          cyclesCompleted: circleMembers.length,
          totalSavedUsdc,
        }).catch((err) => console.error("[payout] mintCertificate failed:", err));
      }

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

export interface PayoutHistoryRow {
  id: string;
  cycleNumber: number;
  amountUsdc: string;
  txHash: string;
  paidAt: string;
  recipientName: string;
}

export async function getPayoutHistoryByCircle(circleId: string): Promise<PayoutHistoryRow[]> {
  const { rows } = await query<PayoutHistoryRow>(
    `SELECT
       p.id,
       p.cycle_number   AS "cycleNumber",
       p.amount_usdc    AS "amountUsdc",
       p.tx_hash        AS "txHash",
       p.paid_at        AS "paidAt",
       COALESCE(u.display_name, 'Unknown') AS "recipientName"
     FROM payouts p
     JOIN members m ON m.id = p.recipient_member_id
     JOIN users   u ON u.id = m.user_id
     WHERE p.circle_id = $1
     ORDER BY p.cycle_number ASC`,
    [circleId]
  );
  return rows;
}
