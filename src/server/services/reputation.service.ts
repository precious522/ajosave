import { query } from "@/lib/db";
import type { User } from "@/types";

// Score adjustments
const SCORE_INCREMENT = 5; // Points added on-time contribution
const SCORE_DECREMENT = 10; // Points deducted on missed contribution
const MIN_SCORE = 0;
const MAX_SCORE = 100;

/**
 * Update user reputation score when a contribution is confirmed.
 * Called after successful payment confirmation.
 */
export async function incrementReputationOnContribution(userId: string): Promise<number> {
  const { rows } = await query<{ reputation_score: number }>(
    `UPDATE users 
     SET reputation_score = LEAST(reputation_score + $1, $2)
     WHERE id = $3
     RETURNING reputation_score`,
    [SCORE_INCREMENT, MAX_SCORE, userId]
  );

  return rows[0]?.reputation_score ?? 0;
}

/**
 * Update user reputation score when a contribution is missed/defaulted.
 * Called when processing missed contributions.
 */
export async function decrementReputationOnMissedContribution(userId: string): Promise<number> {
  const { rows } = await query<{ reputation_score: number }>(
    `UPDATE users 
     SET reputation_score = GREATEST(reputation_score - $1, $2)
     WHERE id = $3
     RETURNING reputation_score`,
    [SCORE_DECREMENT, MIN_SCORE, userId]
  );

  return rows[0]?.reputation_score ?? 0;
}

/**
 * Get user's current reputation score.
 */
export async function getUserReputation(userId: string): Promise<number> {
  const { rows } = await query<{ reputation_score: number }>(
    `SELECT reputation_score FROM users WHERE id = $1`,
    [userId]
  );

  return rows[0]?.reputation_score ?? 0;
}

/**
 * Check if user meets the minimum reputation requirement for a circle.
 */
export async function checkReputationGate(
  userId: string,
  requiredScore: number
): Promise<{ eligible: boolean; currentScore: number }> {
  const currentScore = await getUserReputation(userId);

  return {
    eligible: currentScore >= requiredScore,
    currentScore,
  };
}

/**
 * Calculate reputation level label based on score.
 */
export function getReputationLevel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Building";
}
