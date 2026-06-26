import { query } from "@/lib/db";
import { randomUUID } from "crypto";
import type { Contribution } from "@/types";

export interface ContributionRow {
  id: string;
  cycleNumber: number;
  amountUsdc: string;
  status: string;
  createdAt: string;
  memberName: string;
  memberId: string;
}

export async function getContributionsByCircle(
  circleId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ data: ContributionRow[]; total: number }> {
  const offset = (page - 1) * limit;

  const { rows } = await query<ContributionRow>(
    `SELECT
       c.id,
       c.cycle_number      AS "cycleNumber",
       c.amount_usdc      AS "amountUsdc",
       c.status           AS "status",
       c.created_at       AS "createdAt",
       COALESCE(u.display_name, 'Unknown') AS "memberName",
       m.id               AS "memberId"
     FROM contributions c
     JOIN members m ON m.id = c.member_id
     JOIN users u ON u.id = m.user_id
     WHERE c.circle_id = $1
     ORDER BY c.created_at DESC
     LIMIT $2 OFFSET $3`,
    [circleId, limit, offset]
  );

  const { rows: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM contributions WHERE circle_id = $1`,
    [circleId]
  );

  const total = parseInt(countRows[0]?.count ?? "0", 10);
  return { data: rows, total };
}

/**
 * Create a pending contribution record for a member in a cycle.
 * Uses ON CONFLICT to be idempotent — safe to call multiple times.
 */
export async function createContribution(
  circleId: string,
  memberId: string,
  cycleNumber: number,
  amountUsdc: string,
  paystackReference: string
): Promise<Contribution> {
  const { rows } = await query<Contribution>(
    `INSERT INTO contributions (id, circle_id, member_id, cycle_number, amount_usdc, status, paystack_reference, created_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())
     ON CONFLICT (member_id, cycle_number) DO UPDATE
       SET paystack_reference = EXCLUDED.paystack_reference
     RETURNING id, circle_id as "circleId", member_id as "memberId",
               cycle_number as "cycleNumber", amount_usdc as "amountUsdc",
               status, tx_hash as "txHash", created_at as "createdAt"`,
    [randomUUID(), circleId, memberId, cycleNumber, amountUsdc, paystackReference]
  );
  return rows[0];
}

/**
 * Return all members who have no confirmed contribution for the given cycle.
 * Used by the missed-contributions cron to mark defaulters.
 */
export async function getMissedContributions(
  circleId: string,
  cycleNumber: number
): Promise<{ memberId: string; userId: string }[]> {
  const { rows } = await query<{ memberId: string; userId: string }>(
    `SELECT m.id as "memberId", m.user_id as "userId"
     FROM members m
     WHERE m.circle_id = $1
       AND m.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM contributions c
         WHERE c.member_id = m.id
           AND c.circle_id = $1
           AND c.cycle_number = $2
           AND c.status = 'confirmed'
       )`,
    [circleId, cycleNumber]
  );
  return rows;
}
