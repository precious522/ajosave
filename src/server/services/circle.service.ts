import { query, transaction } from "@/lib/db";
import { randomUUID } from "crypto";
import type { Circle, Member, CircleStatus } from "@/types";
import type { CreateCircleInput } from "@/types/schemas";
import { getNgnPerUsdc } from "@/lib/fx";

export const ngnToUsdc = async (ngn: number): Promise<string> => {
  const rate = await getNgnPerUsdc();
  return (ngn / rate).toFixed(7);
};

export async function createCircle(
  creatorId: string,
  input: CreateCircleInput
): Promise<Circle> {
  const id = randomUUID();
  const contributionUsdc = await ngnToUsdc(input.contributionNgn);
  const { rows } = await query<Circle>(
    `INSERT INTO circles
       (id, name, creator_id, contribution_usdc, contribution_ngn,
        max_members, cycle_frequency, payout_method, status, current_cycle, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',0,NOW(),NOW())
     RETURNING *`,
    [id, input.name, creatorId, contributionUsdc, input.contributionNgn,
     input.maxMembers, input.cycleFrequency, input.payoutMethod]
  );
  return rows[0];
}

export async function getCircleById(id: string): Promise<Circle | null> {
  const { rows } = await query<Circle>(
    "SELECT * FROM circles WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}

export async function listOpenCircles(): Promise<Circle[]> {
  const { rows } = await query<Circle>(
    "SELECT * FROM circles WHERE status = 'open' ORDER BY created_at DESC"
  );
  return rows;
}

export async function getCirclesByUser(userId: string): Promise<Circle[]> {
  const { rows } = await query<Circle>(
    `SELECT DISTINCT c.* FROM circles c
     LEFT JOIN members m ON m.circle_id = c.id
     WHERE c.creator_id = $1 OR m.user_id = $1
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function joinCircle(
  circleId: string,
  userId: string
): Promise<Member> {
  return transaction(async (q) => {
    const { rows: circleRows } = await q<Circle>(
      "SELECT * FROM circles WHERE id = $1 FOR UPDATE",
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.status !== "open") throw new Error("Circle is not open for joining");

    const { rows: memberRows } = await q<Member>(
      "SELECT * FROM members WHERE circle_id = $1 AND status IN ('active', 'pending')",
      [circleId]
    );
    if (memberRows.length >= circle.maxMembers) throw new Error("Circle is full");
    if (memberRows.some((m) => m.userId === userId)) throw new Error("Already a member");

    // For private circles, create pending membership without position
    // For public circles, auto-approve and assign position
    const isPrivate = circle.circleType === "private";
    const status = isPrivate ? "pending" : "active";
    const position = isPrivate ? null : memberRows.filter(m => m.status === 'active').length + 1;

    const { rows: newMember } = await q<Member>(
      `INSERT INTO members (id, circle_id, user_id, position, status, has_received_payout, joined_at)
       VALUES ($1,$2,$3,$4,$5,false,NOW()) RETURNING *`,
      [randomUUID(), circleId, userId, position, status]
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
    "SELECT * FROM members WHERE circle_id = $1 ORDER BY position",
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
      "SELECT * FROM circles WHERE id = $1 FOR UPDATE",
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.status !== "open") throw new Error("Positions can only be shuffled before the circle starts");

    const { rows: memberRows } = await q<Member>(
      "SELECT * FROM members WHERE circle_id = $1 ORDER BY position",
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
