import { query } from "@/lib/db";
import { getCircleById } from "./circle.service";

export interface WaitlistStatus {
  isOnWaitlist: boolean;
  position: number | null;
}

/**
 * Add a user to a circle's waitlist if the circle is full.
 */
export async function addToWaitlist(circleId: string, userId: string): Promise<WaitlistStatus> {
  const circle = await getCircleById(circleId);
  if (!circle) {
    throw new Error("Circle not found");
  }
  if (circle.status !== "open") {
    throw new Error("Can only join waitlist for open circles");
  }

  // Ensure user is not already a member
  const { rows: memberCheck } = await query(
    "SELECT id FROM members WHERE circle_id = $1 AND user_id = $2 AND status IN ('active', 'pending')",
    [circleId, userId]
  );
  if (memberCheck.length > 0) {
    throw new Error("Already a member of this circle");
  }

  // Ensure circle is full
  const { rows: memberRows } = await query(
    "SELECT id FROM members WHERE circle_id = $1 AND status IN ('active', 'pending')",
    [circleId]
  );
  if (memberRows.length < circle.maxMembers) {
    throw new Error("Circle has spots available; join the circle directly");
  }

  // Add to waitlist
  await query(
    `INSERT INTO circle_waitlist (circle_id, user_id, joined_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (circle_id, user_id) DO NOTHING`,
    [circleId, userId]
  );

  const position = await getWaitlistPosition(circleId, userId);
  return { isOnWaitlist: true, position };
}

/**
 * Remove a user from a circle's waitlist.
 */
export async function removeFromWaitlist(circleId: string, userId: string): Promise<WaitlistStatus> {
  await query(
    "DELETE FROM circle_waitlist WHERE circle_id = $1 AND user_id = $2",
    [circleId, userId]
  );
  return { isOnWaitlist: false, position: null };
}

/**
 * Calculate the 1-based queue position of a user in the waitlist.
 */
export async function getWaitlistPosition(circleId: string, userId: string): Promise<number | null> {
  const { rows: check } = await query(
    "SELECT 1 FROM circle_waitlist WHERE circle_id = $1 AND user_id = $2",
    [circleId, userId]
  );
  if (check.length === 0) {
    return null;
  }

  const { rows } = await query<{ position: number }>(
    `SELECT COUNT(*)::int + 1 AS position
     FROM circle_waitlist
     WHERE circle_id = $1
       AND joined_at < (
         SELECT joined_at FROM circle_waitlist WHERE circle_id = $1 AND user_id = $2
       )`,
    [circleId, userId]
  );

  return rows[0]?.position ?? 1;
}

/**
 * Get the user ID of the first member in the waitlist queue (FIFO).
 */
export async function getFirstWaitlistMember(circleId: string): Promise<string | null> {
  const { rows } = await query<{ user_id: string }>(
    `SELECT user_id FROM circle_waitlist
     WHERE circle_id = $1
     ORDER BY joined_at ASC
     LIMIT 1`,
    [circleId]
  );
  return rows[0]?.user_id ?? null;
}

/**
 * Get waitlist status for a user.
 */
export async function getWaitlistStatus(circleId: string, userId: string): Promise<WaitlistStatus> {
  const position = await getWaitlistPosition(circleId, userId);
  return {
    isOnWaitlist: position !== null,
    position,
  };
}
