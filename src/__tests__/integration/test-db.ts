import { randomUUID } from "crypto";
import { query, closePool } from "../../lib/db";

export async function resetIntegrationDatabase() {
  await query(
    `TRUNCATE circle_waitlist, contributions, members, circles, users RESTART IDENTITY CASCADE`
  );
}

export async function seedUser(overrides?: {
  id?: string;
  phone?: string;
  displayName?: string;
  email?: string | null;
  stellarPublicKey?: string | null;
  reputationScore?: number;
}) {
  const id = overrides?.id ?? randomUUID();
  await query(
    `INSERT INTO users (id, phone, display_name, email, stellar_public_key, reputation_score, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      id,
      overrides?.phone ?? "+15551234567",
      overrides?.displayName ?? "Integration User",
      overrides?.email ?? null,
      overrides?.stellarPublicKey ?? null,
      overrides?.reputationScore ?? 0,
    ]
  );
  return id;
}

export async function seedCircle(options: {
  creatorId: string;
  id?: string;
  name?: string;
  maxMembers?: number;
  status?: string;
  contributionUsdc?: string;
  contributionFiat?: string;
  contributionCurrency?: string;
  circleType?: string;
  payoutMethod?: string;
}) {
  const id = options.id ?? randomUUID();
  await query(
    `INSERT INTO circles
       (id, name, creator_id, contribution_usdc, contribution_fiat, contribution_currency,
        max_members, cycle_frequency, payout_method, contract_id, grace_period_hours, status,
        current_cycle, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())`,
    [
      id,
      options.name ?? "Integration Circle",
      options.creatorId,
      options.contributionUsdc ?? "1.0000000",
      options.contributionFiat ?? "100.00",
      options.contributionCurrency ?? "NGN",
      options.maxMembers ?? 5,
      "weekly",
      options.payoutMethod ?? "randomized",
      null,
      24,
      options.status ?? "open",
      0,
    ]
  );
  return id;
}

export async function seedMember(
  circleId: string,
  userId: string,
  overrides?: {
    id?: string;
    position?: number;
    status?: string;
  }
) {
  const id = overrides?.id ?? randomUUID();
  await query(
    `INSERT INTO members
       (id, circle_id, user_id, position, status, has_received_payout, joined_at)
     VALUES ($1, $2, $3, $4, $5, false, NOW())`,
    [id, circleId, userId, overrides?.position ?? 1, overrides?.status ?? "active"]
  );
  return id;
}

export async function seedContribution(
  memberId: string,
  overrides?: {
    id?: string;
    cycle?: number;
    status?: string;
    amountUsdc?: string;
    paystackReference?: string;
  }
) {
  const id = overrides?.id ?? randomUUID();
  await query(
    `INSERT INTO contributions
       (id, member_id, cycle, status, amount_usdc, paystack_reference, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      id,
      memberId,
      overrides?.cycle ?? 1,
      overrides?.status ?? "confirmed",
      overrides?.amountUsdc ?? "1.0000000",
      overrides?.paystackReference ?? `ref_${randomUUID()}`,
    ]
  );
  return id;
}

export async function closeTestDatabase() {
  await closePool();
}
