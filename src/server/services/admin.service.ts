import { query } from "@/lib/db";
import type { Circle, Payout } from "@/types";

export interface AdminCircleRow extends Circle {
  memberCount: number;
}

export interface AdminPayoutRow extends Payout {
  circleName: string;
  recipientUserId: string;
}

/**
 * List all circles with their current member count.
 */
export async function adminListCircles(): Promise<AdminCircleRow[]> {
  const { rows } = await query<AdminCircleRow>(
    `SELECT
       c.id, c.name, c.creator_id as "creatorId",
       c.contribution_usdc as "contributionUsdc",
       c.contribution_ngn as "contributionNgn",
       c.max_members as "maxMembers",
       c.cycle_frequency as "cycleFrequency",
       c.status, c.contract_id as "contractId",
       c.current_cycle as "currentCycle",
       c.next_payout_at as "nextPayoutAt",
       c.created_at as "createdAt",
       c.updated_at as "updatedAt",
       COUNT(m.id)::int AS "memberCount"
     FROM circles c
     LEFT JOIN members m ON m.circle_id = c.id
     GROUP BY c.id
     ORDER BY c.created_at DESC`
  );
  return rows;
}

/**
 * List all payouts across all circles, joined with circle name and recipient user id.
 */
export async function adminListPayouts(): Promise<AdminPayoutRow[]> {
  const { rows } = await query<AdminPayoutRow>(
    `SELECT
       p.id, p.circle_id as "circleId",
       p.recipient_member_id as "recipientMemberId",
       p.cycle_number as "cycleNumber",
       p.amount_usdc as "amountUsdc",
       p.tx_hash as "txHash",
       p.paid_at as "paidAt",
       c.name as "circleName",
       m.user_id as "recipientUserId"
     FROM payouts p
     JOIN circles c ON c.id = p.circle_id
     JOIN members m ON m.id = p.recipient_member_id
     ORDER BY p.paid_at DESC`
  );
  return rows;
}
