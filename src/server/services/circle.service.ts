import { query, transaction } from "@/lib/db";
import { randomUUID } from "crypto";
import type { Circle, Member, CircleStatus } from "@/types";
import type { CreateCircleInput } from "@/types/schemas";
import { getFiatPerUsdc } from "@/lib/fx";
import { deployAjoContract } from "@/lib/soroban";
import { sendUsdcPayment } from "@/lib/stellar";
import { notifyCircleCancelled } from "./notification.service";

export const fiatToUsdc = async (amount: number, currency: string): Promise<string> => {
  const rate = await getFiatPerUsdc(currency);
  return (amount / rate).toFixed(7);
};

const CIRCLE_SELECT = `
  id, name, creator_id as "creatorId", 
  contribution_usdc as "contributionUsdc", 
  contribution_fiat as "contributionFiat", 
  contribution_currency as "contributionCurrency",
  circle_type as "circleType",
  max_members as "maxMembers", 
  cycle_frequency as "cycleFrequency", 
  payout_method as "payoutMethod", 
  randomization_seed as "randomizationSeed",
  status, contract_id as "contractId", 
  current_cycle as "currentCycle", 
  (SELECT COUNT(*)::int FROM members WHERE circle_id = circles.id AND status = 'active') as "memberCount",
  next_payout_at as "nextPayoutAt", 
  created_at as "createdAt", 
  updated_at as "updatedAt"
`;

const MEMBER_SELECT = `
  id, circle_id as "circleId", user_id as "userId", 
  position, status, has_received_payout as "hasReceivedPayout", 
  joined_at as "joinedAt", reviewed_at as "reviewedAt"
`;

export async function createCircle(
  creatorId: string,
  input: CreateCircleInput
): Promise<Circle> {
  const id = randomUUID();
  const contributionUsdc = await fiatToUsdc(input.contributionAmount, input.contributionCurrency);

  // Deploy a dedicated Soroban contract instance for this circle
  let contractId: string | null = null;
  try {
    contractId = await deployAjoContract();
  } catch (err) {
    console.error("[createCircle] Contract deployment failed, proceeding without contractId:", err);
  }

  const { rows } = await query<Circle>(
    `INSERT INTO circles
       (id, name, creator_id, contribution_usdc, contribution_fiat, contribution_currency,
        max_members, cycle_frequency, payout_method, contract_id, status, current_cycle, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open',0,NOW(),NOW())
     RETURNING ${CIRCLE_SELECT}`,
    [id, input.name, creatorId, contributionUsdc, input.contributionAmount, input.contributionCurrency,
     input.maxMembers, input.cycleFrequency, input.payoutMethod, contractId]
  );
  return rows[0];
}

export async function getCircleById(id: string): Promise<Circle | null> {
  const { rows } = await query<Circle>(
    `SELECT ${CIRCLE_SELECT} FROM circles WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export interface PaginatedCircles {
  data: Circle[];
  total: number;
  page: number;
  limit: number;
}

export interface CircleFilters {
  frequency?: CycleFrequency;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  search?: string;
}

export async function listOpenCircles(
  page = 1,
  limit = 20,
  filters: CircleFilters = {}
): Promise<PaginatedCircles> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  let queryText = `SELECT ${CIRCLE_SELECT} FROM circles WHERE status = 'open'`;
  let countQueryText = "SELECT COUNT(*) FROM circles WHERE status = 'open'";
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (filters.frequency) {
    queryText += ` AND cycle_frequency = $${paramIndex}`;
    countQueryText += ` AND cycle_frequency = $${paramIndex}`;
    queryParams.push(filters.frequency);
    paramIndex++;
  }

  if (filters.currency) {
    queryText += ` AND contribution_currency = $${paramIndex}`;
    countQueryText += ` AND contribution_currency = $${paramIndex}`;
    queryParams.push(filters.currency);
    paramIndex++;
  }

  if (filters.minAmount !== undefined) {
    queryText += ` AND contribution_fiat >= $${paramIndex}`;
    countQueryText += ` AND contribution_fiat >= $${paramIndex}`;
    queryParams.push(filters.minAmount);
    paramIndex++;
  }

  if (filters.maxAmount !== undefined) {
    queryText += ` AND contribution_fiat <= $${paramIndex}`;
    countQueryText += ` AND contribution_fiat <= $${paramIndex}`;
    queryParams.push(filters.maxAmount);
    paramIndex++;
  }

  if (filters.search) {
    queryText += ` AND name ILIKE $${paramIndex}`;
    countQueryText += ` AND name ILIKE $${paramIndex}`;
    queryParams.push(`%${filters.search}%`);
    paramIndex++;
  }

  queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  const finalParams = [...queryParams, safeLimit, offset];

  const [{ rows }, { rows: countRows }] = await Promise.all([
    query<Circle>(queryText, finalParams),
    query<{ count: string }>(countQueryText, queryParams),
  ]);

  return { data: rows, total: parseInt(countRows[0].count, 10), page: safePage, limit: safeLimit };
}

export async function getCirclesByUser(userId: string): Promise<Circle[]> {
  const { rows } = await query<Circle>(
    `SELECT DISTINCT c.id, c.name, c.creator_id as "creatorId", 
        c.contribution_usdc as "contributionUsdc", 
        c.contribution_fiat as "contributionFiat", 
        c.contribution_currency as "contributionCurrency",
        c.circle_type as "circleType",
        c.max_members as "maxMembers", 
        c.cycle_frequency as "cycleFrequency", 
        c.payout_method as "payoutMethod", 
        c.randomization_seed as "randomizationSeed",
        c.status, c.contract_id as "contractId", 
        c.current_cycle as "currentCycle", 
        c.next_payout_at as "nextPayoutAt", 
        c.created_at as "createdAt", 
        c.updated_at as "updatedAt"
     FROM circles c
     LEFT JOIN members m ON m.circle_id = c.id
     WHERE c.creator_id = $1 OR m.user_id = $1
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function joinCircle(
  circleId: string,
  userId: string,
  isInvited: boolean = false
): Promise<Member> {
  return transaction(async (q) => {
    const { rows: circleRows } = await q<Circle>(
      `SELECT ${CIRCLE_SELECT} FROM circles WHERE id = $1 FOR UPDATE`,
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.status !== "open") throw new Error("Circle is not open for joining");

    const { rows: memberRows } = await q<Member>(
      `SELECT ${MEMBER_SELECT} FROM members WHERE circle_id = $1 AND status IN ('active', 'pending')`,
      [circleId]
    );
    if (memberRows.length >= circle.maxMembers) throw new Error("Circle is full");
    if (memberRows.some((m) => m.userId === userId)) throw new Error("Already a member");

    // For private circles, create pending membership without position UNLESS invited
    // For public circles, auto-approve and assign position
    const isPrivate = circle.circleType === "private";
    const status = (isPrivate && !isInvited) ? "pending" : "active";
    const position = status === "active" ? memberRows.filter(m => m.status === 'active').length + 1 : null;
    const reviewedAt = (status === "active" && isPrivate) ? new Date() : null;

    const { rows: newMember } = await q<Member>(
      `INSERT INTO members (id, circle_id, user_id, position, status, has_received_payout, joined_at, reviewed_at)
       VALUES ($1,$2,$3,$4,$5,false,NOW(), $6) RETURNING ${MEMBER_SELECT}`,
      [randomUUID(), circleId, userId, position, status, reviewedAt]
    );

    // Auto-start when full (only count active members)
    const activeMembers = memberRows.filter(m => m.status === 'active').length + (status === 'active' ? 1 : 0);
    if (activeMembers === circle.maxMembers) {
      await q(
        `UPDATE circles
         SET status='active', current_cycle=1,
             next_payout_at=$1, updated_at=NOW()
         WHERE id=$2`,
        [computeNextPayoutDate(circle.cycleFrequency), circleId]
      );
    }

    return newMember[0];
  });
}

export async function getMembersByCircle(circleId: string): Promise<Member[]> {
  const { rows } = await query<Member>(
    `SELECT ${MEMBER_SELECT} FROM members WHERE circle_id = $1 ORDER BY position`,
    [circleId]
  );
  return rows;
}

export async function updateCircleStatus(id: string, status: CircleStatus): Promise<void> {
  await query(
    "UPDATE circles SET status=$1, updated_at=NOW() WHERE id=$2",
    [status, id]
  );
}

export async function shuffleAndPersistPositions(
  circleId: string,
  seed: string
): Promise<Member[]> {
  return transaction(async (q) => {
    const { rows: circleRows } = await q<Circle>(
      `SELECT ${CIRCLE_SELECT} FROM circles WHERE id = $1 FOR UPDATE`,
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.status !== "open") throw new Error("Positions can only be shuffled before the circle starts");

    const { rows: memberRows } = await q<Member>(
      `SELECT ${MEMBER_SELECT} FROM members WHERE circle_id = $1 ORDER BY position`,
      [circleId]
    );

    // Fisher-Yates shuffle using seed for deterministic randomization
    const positions = memberRows.map((_, i) => i + 1);
    const seededRandom = createSeededRandom(seed);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Update member positions
    for (let i = 0; i < memberRows.length; i++) {
      await q(
        "UPDATE members SET position = $1, updated_at = NOW() WHERE id = $2",
        [positions[i], memberRows[i].id]
      );
    }

    // Store seed and mark as randomized
    await q(
      "UPDATE circles SET payout_method = 'randomized', randomization_seed = $1, updated_at = NOW() WHERE id = $2",
      [seed, circleId]
    );

    // Return shuffled members sorted by new position
    const shuffled = memberRows.map((m, i) => ({ ...m, position: positions[i] }));
    return shuffled.sort((a, b) => a.position - b.position);
  });
}

function createSeededRandom(seed: string): () => number {
  // Simple seeded PRNG using hash-based approach
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return function () {
    hash = (hash * 9301 + 49297) % 233280;
    return hash / 233280;
  };
}

function computeNextPayoutDate(frequency: Circle["cycleFrequency"]): Date {
  const d = new Date();
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export async function approveJoinRequest(
  circleId: string,
  memberId: string,
  creatorId: string
): Promise<Member> {
  return transaction(async (q) => {
    // Verify creator owns the circle
    const { rows: circleRows } = await q<Circle>(
      "SELECT * FROM circles WHERE id = $1 FOR UPDATE",
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.creatorId !== creatorId) throw new Error("Only the creator can approve join requests");
    if (circle.circleType !== "private") throw new Error("Only private circles require approval");

    // Get the member
    const { rows: memberRows } = await q<Member>(
      "SELECT * FROM members WHERE id = $1 AND circle_id = $2",
      [memberId, circleId]
    );
    const member = memberRows[0];
    if (!member) throw new Error("Member not found");
    if (member.status !== "pending") throw new Error("Member is not pending approval");

    // Count active members to assign position
    const { rows: activeMembers } = await q<Member>(
      "SELECT * FROM members WHERE circle_id = $1 AND status = 'active'",
      [circleId]
    );
    const position = activeMembers.length + 1;

    // Approve the member
    const { rows: updatedMember } = await q<Member>(
      `UPDATE members
       SET status = 'active', position = $1, reviewed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [position, memberId]
    );

    // Auto-start circle if now full
    if (activeMembers.length + 1 === circle.maxMembers) {
      await q(
        `UPDATE circles
         SET status='active', current_cycle=1,
             next_payout_at=$1, updated_at=NOW()
         WHERE id=$2`,
        [computeNextPayoutDate(circle.cycleFrequency), circleId]
      );
    }

    return updatedMember[0];
  });
}

export async function rejectJoinRequest(
  circleId: string,
  memberId: string,
  creatorId: string
): Promise<Member> {
  return transaction(async (q) => {
    // Verify creator owns the circle
    const { rows: circleRows } = await q<Circle>(
      "SELECT * FROM circles WHERE id = $1",
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.creatorId !== creatorId) throw new Error("Only the creator can reject join requests");
    if (circle.circleType !== "private") throw new Error("Only private circles require approval");

    // Get the member
    const { rows: memberRows } = await q<Member>(
      "SELECT * FROM members WHERE id = $1 AND circle_id = $2",
      [memberId, circleId]
    );
    const member = memberRows[0];
    if (!member) throw new Error("Member not found");
    if (member.status !== "pending") throw new Error("Member is not pending approval");

    // Reject the member
    const { rows: updatedMember } = await q<Member>(
      `UPDATE members
       SET status = 'rejected', reviewed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [memberId]
    );

    return updatedMember[0];
  });
}

export async function getPendingJoinRequests(circleId: string): Promise<Member[]> {
  const { rows } = await query<Member>(
    "SELECT * FROM members WHERE circle_id = $1 AND status = 'pending' ORDER BY joined_at ASC",
    [circleId]
  );
  return rows;
}

/**
 * Cancel an open circle, issue USDC refunds to members who already paid,
 * and notify all members via SMS.
 *
 * Rules:
 * - Only the circle creator can cancel.
 * - Only circles with status 'open' can be cancelled (not active/completed).
 * - Each member with confirmed contributions receives a USDC refund to their
 *   Stellar public key. Members without a Stellar key are skipped and their
 *   contributions are left as 'refund_pending' for manual resolution.
 * - The circle status is set to 'cancelled' atomically before refunds are sent.
 *   Refunds are best-effort: failures are logged but do not roll back the cancellation.
 */
export async function cancelCircle(
  circleId: string,
  requesterId: string
): Promise<Circle> {
  // ── Step 1: Validate and atomically cancel the circle ──────────────────────
  const circle = await transaction(async (q) => {
    const { rows: circleRows } = await q<{
      id: string;
      name: string;
      creator_id: string;
      status: string;
      contribution_usdc: string;
    }>(
      "SELECT id, name, creator_id, status, contribution_usdc FROM circles WHERE id = $1 FOR UPDATE",
      [circleId]
    );
    const raw = circleRows[0];
    if (!raw) throw new Error("Circle not found");
    if (raw.creator_id !== requesterId) throw new Error("Only the creator can cancel a circle");
    if (raw.status !== "open") throw new Error("Only open circles can be cancelled");

    // Mark confirmed contributions as refund_pending within the same transaction
    await q(
      `UPDATE contributions
       SET status = 'refund_pending', updated_at = NOW()
       WHERE circle_id = $1 AND status = 'confirmed'`,
      [circleId]
    );

    const { rows: updated } = await q<Circle>(
      `UPDATE circles
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, creator_id as "creatorId",
                 contribution_usdc as "contributionUsdc",
                 contribution_ngn as "contributionFiat",
                 'NGN' as "contributionCurrency",
                 max_members as "maxMembers",
                 cycle_frequency as "cycleFrequency",
                 payout_method as "payoutMethod",
                 randomization_seed as "randomizationSeed",
                 status, contract_id as "contractId",
                 current_cycle as "currentCycle",
                 next_payout_at as "nextPayoutAt",
                 created_at as "createdAt",
                 updated_at as "updatedAt"`,
      [circleId]
    );
    return updated[0];
  });

  // ── Step 2: Fetch members with refund_pending contributions ────────────────
  const { rows: refundRows } = await query<{
    member_id: string;
    user_id: string;
    stellar_public_key: string | null;
    total_usdc: string;
  }>(
    `SELECT
       c.member_id,
       m.user_id,
       u.stellar_public_key,
       SUM(c.amount_usdc)::text AS total_usdc
     FROM contributions c
     JOIN members m ON m.id = c.member_id
     JOIN users u ON u.id = m.user_id
     WHERE c.circle_id = $1 AND c.status = 'refund_pending'
     GROUP BY c.member_id, m.user_id, u.stellar_public_key`,
    [circleId]
  );

  // ── Step 3: Issue refunds and notify members (best-effort, non-blocking) ───
  const refundJobs = refundRows.map(async (row) => {
    const { member_id, user_id, stellar_public_key, total_usdc } = row;

    if (!stellar_public_key) {
      // No Stellar key on file — leave as refund_pending for manual resolution
      console.warn(
        `[cancelCircle] Member ${member_id} has no Stellar key; skipping refund (left as refund_pending)`
      );
      notifyCircleCancelled(user_id, circle.name, null).catch((err) =>
        console.error(`[cancelCircle] SMS notification failed for ${user_id}:`, err)
      );
      return;
    }

    try {
      const txHash = await sendUsdcPayment(stellar_public_key, total_usdc);

      // Mark contributions as refunded and record the tx hash
      await query(
        `UPDATE contributions
         SET status = 'refunded', tx_hash = $1, updated_at = NOW()
         WHERE circle_id = $2 AND member_id = $3 AND status = 'refund_pending'`,
        [txHash, circleId, member_id]
      );

      console.log(
        `[cancelCircle] Refunded ${total_usdc} USDC to member ${member_id} (tx: ${txHash})`
      );

      notifyCircleCancelled(user_id, circle.name, total_usdc).catch((err) =>
        console.error(`[cancelCircle] SMS notification failed for ${user_id}:`, err)
      );
    } catch (err) {
      // Refund failed — leave as refund_pending for retry/manual resolution
      console.error(
        `[cancelCircle] Refund failed for member ${member_id} (${total_usdc} USDC):`,
        err
      );
      notifyCircleCancelled(user_id, circle.name, null).catch((notifyErr) =>
        console.error(`[cancelCircle] SMS notification failed for ${user_id}:`, notifyErr)
      );
    }
  });

  // Notify members with no contributions (joined but never paid)
  const { rows: noContribMembers } = await query<{ user_id: string }>(
    `SELECT DISTINCT m.user_id
     FROM members m
     WHERE m.circle_id = $1
       AND m.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM contributions c
         WHERE c.member_id = m.id AND c.circle_id = $1
       )`,
    [circleId]
  );

  const noContribJobs = noContribMembers.map(({ user_id }) =>
    notifyCircleCancelled(user_id, circle.name, null).catch((err) =>
      console.error(`[cancelCircle] SMS notification failed for ${user_id}:`, err)
    )
  );

  // Fire all refunds and notifications concurrently; don't block the response
  Promise.allSettled([...refundJobs, ...noContribJobs]).catch((err) =>
    console.error("[cancelCircle] Unexpected error in refund/notification batch:", err)
  );

  return circle;
}

/**
 * Leave an open circle.
 * Only members who are not the creator can leave.
 */
export async function leaveCircle(
  circleId: string,
  userId: string
): Promise<void> {
  return transaction(async (q) => {
    const { rows: circleRows } = await q<Circle>(
      "SELECT * FROM circles WHERE id = $1 FOR UPDATE",
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.status !== "open") throw new Error("Can only leave open circles");
    if (circle.creatorId === userId) throw new Error("Creator cannot leave the circle; cancel it instead");

    // Remove the member
    const { rowCount } = await q(
      "DELETE FROM members WHERE circle_id = $1 AND user_id = $2",
      [circleId, userId]
    );
    if (rowCount === 0) throw new Error("Not a member of this circle");

    // Re-assign positions for remaining active members to keep them contiguous
    const { rows: remainingMembers } = await q<Member>(
      "SELECT id FROM members WHERE circle_id = $1 AND status = 'active' ORDER BY position ASC",
      [circleId]
    );

    for (let i = 0; i < remainingMembers.length; i++) {
      await q(
        "UPDATE members SET position = $1 WHERE id = $2",
        [i + 1, remainingMembers[i].id]
      );
    }
  });
}
