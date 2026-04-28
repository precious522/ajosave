// ─── User ─────────────────────────────────────────────────────────────────────
export type UserRole = "user" | "admin";

export interface User {
  id: string;
  phone: string;
  displayName: string;
  email?: string;
  stellarPublicKey?: string;
  reputationScore: number; // 0–100, built from on-time contributions
  role: UserRole;
  createdAt: Date;
}

// ─── Circle ───────────────────────────────────────────────────────────────────
export type CircleStatus = "open" | "active" | "completed" | "cancelled";
export type CycleFrequency = "weekly" | "biweekly" | "monthly";
export type PayoutMethod = "fixed" | "randomized";

export interface Circle {
  id: string;
  name: string;
  creatorId: string;
  contributionUsdc: string;   // per-member per-cycle amount
  contributionFiat: number;   // renamed from contributionNgn
  contributionCurrency: SupportedCurrency;
  maxMembers: number;
  cycleFrequency: CycleFrequency;
  payoutMethod: PayoutMethod;
  randomizationSeed?: string; // stored seed for verifiability
  status: CircleStatus;
  contractId?: string;        // deployed Soroban circle contract
  currentCycle: number;       // 1-indexed
  nextPayoutAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Membership ───────────────────────────────────────────────────────────────
export type MemberStatus = "pending" | "active" | "rejected" | "defaulted" | "completed";

export interface Member {
  id: string;
  circleId: string;
  userId: string;
  position: number | null;    // payout order (1 = first to receive), null for pending members
  status: MemberStatus;
  hasReceivedPayout: boolean;
  joinedAt: Date;
  reviewedAt?: Date;          // when creator approved/rejected the request
}

// ─── Contribution ─────────────────────────────────────────────────────────────
export type ContributionStatus = "pending" | "confirmed" | "missed" | "refund_pending" | "refunded";

export interface Contribution {
  id: string;
  circleId: string;
  memberId: string;
  cycleNumber: number;
  amountUsdc: string;
  status: ContributionStatus;
  txHash?: string;
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Payout ───────────────────────────────────────────────────────────────────
export interface Payout {
  id: string;
  circleId: string;
  recipientMemberId: string;
  cycleNumber: number;
  amountUsdc: string;
  txHash: string;
  paidAt: Date;
}

// ─── API ──────────────────────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
}
export interface ApiError {
  success: false;
  error: string;
  code?: string;
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
