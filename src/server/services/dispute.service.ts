import { query } from "@/lib/db";
import { randomUUID } from "crypto";
import type { Dispute } from "@/types";

export async function createDispute(
  contributionId: string,
  memberId: string,
  circleId: string,
  reason: string,
  paystackReference?: string
): Promise<Dispute> {
  const { rows } = await query<Dispute>(
    `INSERT INTO disputes (id, contribution_id, member_id, circle_id, paystack_reference, reason, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW())
     RETURNING id, contribution_id as "contributionId", member_id as "memberId",
               circle_id as "circleId", paystack_reference as "paystackReference",
               reason, status, resolution_notes as "resolutionNotes",
               resolved_by as "resolvedBy", created_at as "createdAt", resolved_at as "resolvedAt"`,
    [randomUUID(), contributionId, memberId, circleId, paystackReference || null, reason]
  );
  return rows[0];
}

export async function getDisputesByCircle(circleId: string): Promise<Dispute[]> {
  const { rows } = await query<Dispute>(
    `SELECT id, contribution_id as "contributionId", member_id as "memberId",
            circle_id as "circleId", paystack_reference as "paystackReference",
            reason, status, resolution_notes as "resolutionNotes",
            resolved_by as "resolvedBy", created_at as "createdAt", resolved_at as "resolvedAt"
     FROM disputes
     WHERE circle_id = $1
     ORDER BY created_at DESC`,
    [circleId]
  );
  return rows;
}

export async function getDisputesByMember(memberId: string): Promise<Dispute[]> {
  const { rows } = await query<Dispute>(
    `SELECT id, contribution_id as "contributionId", member_id as "memberId",
            circle_id as "circleId", paystack_reference as "paystackReference",
            reason, status, resolution_notes as "resolutionNotes",
            resolved_by as "resolvedBy", created_at as "createdAt", resolved_at as "resolvedAt"
     FROM disputes
     WHERE member_id = $1
     ORDER BY created_at DESC`,
    [memberId]
  );
  return rows;
}

export async function resolveDispute(
  disputeId: string,
  status: "resolved" | "rejected",
  resolutionNotes: string,
  resolvedBy: string
): Promise<Dispute> {
  const { rows } = await query<Dispute>(
    `UPDATE disputes
     SET status = $2, resolution_notes = $3, resolved_by = $4, resolved_at = NOW()
     WHERE id = $1
     RETURNING id, contribution_id as "contributionId", member_id as "memberId",
               circle_id as "circleId", paystack_reference as "paystackReference",
               reason, status, resolution_notes as "resolutionNotes",
               resolved_by as "resolvedBy", created_at as "createdAt", resolved_at as "resolvedAt"`,
    [disputeId, status, resolutionNotes, resolvedBy]
  );
  return rows[0];
}

export async function confirmContributionFromDispute(
  disputeId: string,
  contributionId: string,
  txHash: string
): Promise<void> {
  await query(
    `UPDATE contributions
     SET status = 'confirmed', tx_hash = $2
     WHERE id = $3`,
    [disputeId, txHash, contributionId]
  );

  // Get user ID from contribution and increment reputation
  const { rows } = await query<{ user_id: string }>(
    `SELECT m.user_id FROM contributions c
     JOIN members m ON m.id = c.member_id
     WHERE c.id = $1`,
    [contributionId]
  );

  if (rows[0]?.user_id) {
    const { incrementReputationOnContribution } = await import("./reputation.service");
    await incrementReputationOnContribution(rows[0].user_id);
  }
}
