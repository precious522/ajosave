import { query, transaction } from "@/lib/db";
import { randomUUID } from "crypto";
import { sendUsdcPayment } from "@/lib/stellar";
import type { EarlyExitRequest } from "@/types";

/** Default penalty: 10% of total confirmed contributions */
const DEFAULT_PENALTY_PERCENT = 10;

const EXIT_SELECT = `
  id, circle_id as "circleId", member_id as "memberId", user_id as "userId",
  penalty_percent as "penaltyPercent", penalty_usdc as "penaltyUsdc",
  refund_usdc as "refundUsdc", status, created_at as "createdAt", processed_at as "processedAt"
`;

export async function requestEarlyExit(
  circleId: string,
  userId: string,
  penaltyPercent: number = DEFAULT_PENALTY_PERCENT
): Promise<EarlyExitRequest> {
  return transaction(async (q) => {
    // Verify member is active in the circle
    const { rows: memberRows } = await q<{ id: string; status: string }>(
      `SELECT id, status FROM members WHERE circle_id = $1 AND user_id = $2 FOR UPDATE`,
      [circleId, userId]
    );
    const member = memberRows[0];
    if (!member) throw new Error("Not a member of this circle");
    if (member.status !== "active") throw new Error("Only active members can request early exit");

    // Check no pending exit request already exists
    const { rows: existing } = await q<{ id: string }>(
      `SELECT id FROM early_exit_requests WHERE member_id = $1 AND status = 'pending'`,
      [member.id]
    );
    if (existing.length > 0) throw new Error("An early exit request is already pending");

    // Calculate total confirmed contributions for this member
    const { rows: contribRows } = await q<{ total: string }>(
      `SELECT COALESCE(SUM(amount_usdc), 0)::text as total
       FROM contributions WHERE member_id = $1 AND status = 'confirmed'`,
      [member.id]
    );
    const totalUsdc = parseFloat(contribRows[0]?.total ?? "0");
    const penaltyUsdc = (totalUsdc * penaltyPercent) / 100;
    const refundUsdc = totalUsdc - penaltyUsdc;

    const { rows } = await q<EarlyExitRequest>(
      `INSERT INTO early_exit_requests (id, circle_id, member_id, user_id, penalty_percent, penalty_usdc, refund_usdc, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
       RETURNING ${EXIT_SELECT}`,
      [randomUUID(), circleId, member.id, userId, penaltyPercent, penaltyUsdc.toFixed(7), refundUsdc.toFixed(7)]
    );
    return rows[0];
  });
}

export async function approveEarlyExit(exitRequestId: string): Promise<EarlyExitRequest> {
  // Load the request
  const { rows: reqRows } = await query<EarlyExitRequest & { stellarPublicKey: string | null }>(
    `SELECT ${EXIT_SELECT}, u.stellar_public_key as "stellarPublicKey"
     FROM early_exit_requests e
     JOIN users u ON u.id = e.user_id
     WHERE e.id = $1 AND e.status = 'pending'`,
    [exitRequestId]
  );
  const req = reqRows[0];
  if (!req) throw new Error("Exit request not found or already processed");

  // Process refund if member has contributions to return
  const refundAmount = parseFloat(req.refundUsdc);
  if (refundAmount > 0) {
    const stellarKey = (req as any).stellarPublicKey;
    if (!stellarKey) throw new Error("Member has no Stellar public key for refund");
    await sendUsdcPayment(stellarKey, refundAmount.toFixed(7));
  }

  // Mark member as exited and update request status in a transaction
  await transaction(async (q) => {
    await q(
      `UPDATE members SET status = 'completed' WHERE id = $1`,
      [req.memberId]
    );
    await q(
      `UPDATE early_exit_requests SET status = 'approved', processed_at = NOW() WHERE id = $1`,
      [exitRequestId]
    );
    // Re-number remaining active members' positions
    const { rows: remaining } = await q<{ id: string }>(
      `SELECT id FROM members WHERE circle_id = $1 AND status = 'active' ORDER BY position ASC`,
      [req.circleId]
    );
    for (let i = 0; i < remaining.length; i++) {
      await q(`UPDATE members SET position = $1 WHERE id = $2`, [i + 1, remaining[i].id]);
    }
  });

  const { rows } = await query<EarlyExitRequest>(
    `SELECT ${EXIT_SELECT} FROM early_exit_requests WHERE id = $1`,
    [exitRequestId]
  );
  return rows[0];
}

export async function rejectEarlyExit(exitRequestId: string): Promise<EarlyExitRequest> {
  const { rows } = await query<EarlyExitRequest>(
    `UPDATE early_exit_requests SET status = 'rejected', processed_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING ${EXIT_SELECT}`,
    [exitRequestId]
  );
  if (!rows[0]) throw new Error("Exit request not found or already processed");
  return rows[0];
}

export async function getEarlyExitsByCircle(circleId: string): Promise<EarlyExitRequest[]> {
  const { rows } = await query<EarlyExitRequest>(
    `SELECT ${EXIT_SELECT} FROM early_exit_requests WHERE circle_id = $1 ORDER BY created_at DESC`,
    [circleId]
  );
  return rows;
}

export async function getEarlyExitByMember(memberId: string): Promise<EarlyExitRequest | null> {
  const { rows } = await query<EarlyExitRequest>(
    `SELECT ${EXIT_SELECT} FROM early_exit_requests WHERE member_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [memberId]
  );
  return rows[0] ?? null;
}
