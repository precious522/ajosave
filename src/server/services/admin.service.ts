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
 * Pass includeDeleted=true to also return soft-deleted circles.
 */
export async function adminListCircles(includeDeleted = false): Promise<AdminCircleRow[]> {
  const { rows } = await query<AdminCircleRow>(
    `SELECT
       c.id, c.name, c.creator_id as "creatorId",
       c.contribution_usdc as "contributionUsdc",
       c.contribution_fiat as "contributionFiat",
       c.contribution_currency as "contributionCurrency",
       c.circle_type as "circleType",
       c.max_members as "maxMembers",
       c.cycle_frequency as "cycleFrequency",
       c.status, c.contract_id as "contractId",
       c.current_cycle as "currentCycle",
       c.next_payout_at as "nextPayoutAt",
       c.created_at as "createdAt",
       c.updated_at as "updatedAt",
       c.deleted_at as "deletedAt",
       COUNT(m.id)::int AS "memberCount"
     FROM circles c
     LEFT JOIN members m ON m.circle_id = c.id
     WHERE ($1::boolean = true OR c.deleted_at IS NULL)
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [includeDeleted]
  );
  return rows;
}

/**
 * List soft-deleted circles (admin only).
 */
export async function adminListDeletedCircles(): Promise<AdminCircleRow[]> {
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
       c.deleted_at as "deletedAt",
       COUNT(m.id)::int AS "memberCount"
     FROM circles c
     LEFT JOIN members m ON m.circle_id = c.id
     WHERE c.deleted_at IS NOT NULL
     GROUP BY c.id
     ORDER BY c.deleted_at DESC`
  );
  return rows;
}

/**
 * Soft-delete a user by setting deleted_at (admin only).
 */
export async function adminSoftDeleteUser(userId: string): Promise<void> {
  await query(
    "UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    [userId]
  );
}

/**
 * List all users for admin panel.
 */
export async function adminListUsers(search?: string): Promise<{ id: string; displayName: string; phone: string; email: string | null; role: string; reputationScore: number; createdAt: Date; deletedAt: Date | null }[]> {
  const params: string[] = [];
  let where = "WHERE deleted_at IS NULL";
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (display_name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)`;
  }
  const { rows } = await query(
    `SELECT id, display_name as "displayName", phone, email, role,
            reputation_score as "reputationScore", created_at as "createdAt", deleted_at as "deletedAt"
     FROM users ${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return rows;
}

/**
 * Get platform-wide stats.
 */
export async function adminGetPlatformStats(): Promise<{
  totalCircles: number;
  activeCircles: number;
  totalUsers: number;
  totalSavedUsdc: string;
  openDisputes: number;
}> {
  const [circles, users, saved, disputes] = await Promise.all([
    query<{ total: number; active: number }>(
      `SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE status='active')::int as active FROM circles WHERE deleted_at IS NULL`
    ),
    query<{ total: number }>(`SELECT COUNT(*)::int as total FROM users WHERE deleted_at IS NULL`),
    query<{ total: string }>(`SELECT COALESCE(SUM(amount_usdc),0)::text as total FROM contributions WHERE status='confirmed'`),
    query<{ total: number }>(`SELECT COUNT(*)::int as total FROM disputes WHERE status IN ('open','investigating')`),
  ]);
  return {
    totalCircles: circles.rows[0].total,
    activeCircles: circles.rows[0].active,
    totalUsers: users.rows[0].total,
    totalSavedUsdc: saved.rows[0].total,
    openDisputes: disputes.rows[0].total,
  };
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
