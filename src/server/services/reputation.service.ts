import { randomUUID } from "crypto";
import type { ReputationScore } from "@/types";

// In-memory store — replace with DB
const scores = new Map<string, ReputationScore>();

/**
 * Calculate and persist a reputation score for a user.
 *
 * Scoring formula (0–100):
 *   - onTimeContributions × 5  (max 60 pts, capped at 12 on-time)
 *   - circlesCompleted × 10    (max 30 pts, capped at 3 circles)
 *   - defaults × -15           (penalty per default)
 */
export async function calculateReputation(
  userId: string,
  onTimeContributions: number,
  circlesCompleted: number,
  defaults: number,
  stellarTxProof?: string
): Promise<ReputationScore> {
  const raw =
    Math.min(onTimeContributions, 12) * 5 +
    Math.min(circlesCompleted, 3) * 10 -
    defaults * 15;

  const score = Math.max(0, Math.min(100, raw));

  const existing = scores.get(userId);
  const record: ReputationScore = {
    id: existing?.id ?? randomUUID(),
    userId,
    score,
    onTimeContributions,
    circlesCompleted,
    defaults,
    stellarTxProof,
    updatedAt: new Date(),
  };

  scores.set(userId, record);
  return record;
}

export async function getReputation(userId: string): Promise<ReputationScore | null> {
  return scores.get(userId) ?? null;
}
