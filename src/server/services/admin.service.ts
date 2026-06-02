import { query, transaction } from "@/lib/db";
import type { Circle, Member, Payout, ContributionStatus } from "@/types";

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

// ─── Circle Admin: Member Contribution Status ─────────────────────────────────

export interface MemberContributionStatus {
  memberId: string;
  userId: string;
  displayName: string;
  position: number | null;
  memberStatus: string;
  hasReceivedPayout: boolean;
  contributions: {
    cycleNumber: number;
    status: ContributionStatus;
    amountUsdc: string;
    createdAt: Date;
  }[];
}

/**
 * Returns each member of a circle with their contribution status per cycle.
 * Admin-only.
 */
export async function adminGetCircleMemberContributions(
  circleId: string
): Promise<MemberContributionStatus[]> {
  // Fetch all active/defaulted members
  const { rows: members } = await query<{
    memberId: string;
    userId: string;
    displayName: string;
    position: number | null;
    memberStatus: string;
    hasReceivedPayout: boolean;
  }>(
    `SELECT
       m.id AS "memberId",
       m.user_id AS "userId",
       u.display_name AS "displayName",
       m.position,
       m.status AS "memberStatus",
       m.has_received_payout AS "hasReceivedPayout"
     FROM members m
     JOIN users u ON u.id = m.user_id
     WHERE m.circle_id = $1
       AND m.status IN ('active', 'defaulted', 'completed')
     ORDER BY m.position ASC NULLS LAST`,
    [circleId]
  );

  if (members.length === 0) return [];

  // Fetch all contributions for this circle in one query
  const { rows: contributions } = await query<{
    memberId: string;
    cycleNumber: number;
    status: ContributionStatus;
    amountUsdc: string;
    createdAt: Date;
  }>(
    `SELECT
       member_id AS "memberId",
       cycle_number AS "cycleNumber",
       status,
       amount_usdc AS "amountUsdc",
       created_at AS "createdAt"
     FROM contributions
     WHERE circle_id = $1
     ORDER BY member_id, cycle_number ASC`,
    [circleId]
  );

  // Group contributions by memberId
  const contribMap = new Map<string, typeof contributions>();
  for (const c of contributions) {
    if (!contribMap.has(c.memberId)) contribMap.set(c.memberId, []);
    contribMap.get(c.memberId)!.push(c);
  }

  return members.map((m: typeof members[number]) => ({
    ...m,
    contributions: contribMap.get(m.memberId) ?? [],
  }));
}

// ─── Circle Admin: Remove Member ──────────────────────────────────────────────

/**
 * Admin removes a member from a circle.
 * - Works on open or active circles.
 * - Creator cannot be removed.
 * - Marks member as 'rejected', re-sequences positions for remaining active members.
 */
export async function adminRemoveMember(
  circleId: string,
  memberId: string
): Promise<void> {
  await transaction(async (q) => {
    // Lock the circle row
    const { rows: circleRows } = await q<{ creator_id: string; status: string }>(
      "SELECT creator_id, status FROM circles WHERE id = $1 FOR UPDATE",
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (!["open", "active", "paused"].includes(circle.status)) {
      throw new Error("Cannot remove members from a completed or cancelled circle");
    }

    // Fetch the member
    const { rows: memberRows } = await q<{ user_id: string; status: string }>(
      "SELECT user_id, status FROM members WHERE id = $1 AND circle_id = $2",
      [memberId, circleId]
    );
    const member = memberRows[0];
    if (!member) throw new Error("Member not found");
    if (member.user_id === circle.creator_id) throw new Error("Cannot remove the circle creator");
    if (member.status === "rejected") throw new Error("Member is already removed");

    // Mark as rejected
    await q(
      "UPDATE members SET status = 'rejected', updated_at = NOW() WHERE id = $1",
      [memberId]
    );

    // Re-sequence positions for remaining active members
    const { rows: remaining } = await q<{ id: string }>(
      `SELECT id FROM members
       WHERE circle_id = $1 AND status = 'active'
       ORDER BY position ASC NULLS LAST`,
      [circleId]
    );
    for (let i = 0; i < remaining.length; i++) {
      await q("UPDATE members SET position = $1 WHERE id = $2", [i + 1, remaining[i].id]);
    }
  });
}

// ─── Circle Admin: Manual Payout Trigger ─────────────────────────────────────

/**
 * Fetches the next-in-line recipient's Stellar public key for a manual payout trigger.
 * Returns null if the circle is not active or the recipient has no Stellar key.
 */
export async function adminGetPayoutRecipientKey(
  circleId: string
): Promise<{ stellarPublicKey: string; recipientName: string; cycleNumber: number } | null> {
  const { rows } = await query<{
    stellarPublicKey: string | null;
    displayName: string;
    cycleNumber: number;
  }>(
    `SELECT
       u.stellar_public_key AS "stellarPublicKey",
       u.display_name AS "displayName",
       c.current_cycle AS "cycleNumber"
     FROM circles c
     JOIN members m ON m.circle_id = c.id AND m.position = c.current_cycle
     JOIN users u ON u.id = m.user_id
     WHERE c.id = $1 AND c.status = 'active'`,
    [circleId]
  );

  const row = rows[0];
  if (!row || !row.stellarPublicKey) return null;

  return {
    stellarPublicKey: row.stellarPublicKey,
    recipientName: row.displayName,
    cycleNumber: row.cycleNumber,
  };
}
