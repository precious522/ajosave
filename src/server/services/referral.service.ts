import { randomUUID } from "crypto";
import type { Referral } from "@/types";

// In-memory store — replace with DB
const codesByUser = new Map<string, string>();       // userId → code
const codeToUser = new Map<string, string>();        // code → userId
const referrals: Referral[] = [];

/** Get or create a unique referral code for a user. */
export function getReferralCode(userId: string): string {
  if (!codesByUser.has(userId)) {
    const code = userId.slice(0, 8).toUpperCase();
    codesByUser.set(userId, code);
    codeToUser.set(code, userId);
  }
  return codesByUser.get(userId)!;
}

/** Record that a new user joined via a referral code. */
export function trackReferral(code: string, referredUserId: string): Referral | null {
  const referrerId = codeToUser.get(code);
  if (!referrerId || referrerId === referredUserId) return null;

  const referral: Referral = {
    id: randomUUID(),
    referrerId,
    referredUserId,
    code,
    createdAt: new Date(),
  };
  referrals.push(referral);
  return referral;
}

/** Get all referrals made by a user. */
export function getReferralsByUser(userId: string): Referral[] {
  return referrals.filter((r) => r.referrerId === userId);
}

/** Get referral count for a user. */
export function getReferralCount(userId: string): number {
  return referrals.filter((r) => r.referrerId === userId).length;
}
