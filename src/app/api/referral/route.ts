import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { withErrorHandler, withSanitizedBody } from "@/server/middleware";
import { randomBytes } from "crypto";
import type { ApiResponse } from "@/types";

export interface ReferralData {
  referralCode: string;
  referralCount: number;
  referredBy: string | null;
}

function generateCode(): string {
  return randomBytes(4).toString("hex").toUpperCase(); // e.g. "A3F2B1C9"
}

/** GET /api/referral — return the current user's referral code and stats */
export const GET = withErrorHandler(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const userId = (session.user as { id: string }).id;

  // Lazily generate a referral code if the user doesn't have one yet
  const { rows: userRows } = await query<{ referral_code: string | null; referred_by: string | null }>(
    "SELECT referral_code, referred_by FROM users WHERE id = $1",
    [userId]
  );
  let code = userRows[0]?.referral_code ?? null;

  if (!code) {
    code = generateCode();
    await query("UPDATE users SET referral_code = $1 WHERE id = $2", [code, userId]);
  }

  const { rows: countRows } = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM referrals WHERE referrer_id = $1",
    [userId]
  );

  let referredByName: string | null = null;
  if (userRows[0]?.referred_by) {
    const { rows: refRows } = await query<{ display_name: string }>(
      "SELECT display_name FROM users WHERE id = $1",
      [userRows[0].referred_by]
    );
    referredByName = refRows[0]?.display_name ?? null;
  }

  return NextResponse.json<ApiResponse<ReferralData>>({
    success: true,
    data: {
      referralCode: code,
      referralCount: parseInt(countRows[0]?.count ?? "0", 10),
      referredBy: referredByName,
    },
  });
});

/** POST /api/referral — apply a referral code (one-time, before first contribution) */
export const POST = withErrorHandler(withSanitizedBody(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const userId = (session.user as { id: string }).id;

  const { code } = (await req.json()) as { code?: string };
  if (!code || typeof code !== "string") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Referral code is required" },
      { status: 400 }
    );
  }

  await transaction(async (q) => {
    // Ensure user hasn't already been referred
    const { rows: self } = await q<{ referred_by: string | null }>(
      "SELECT referred_by FROM users WHERE id = $1",
      [userId]
    );
    if (self[0]?.referred_by) throw new Error("You have already used a referral code.");

    // Find the referrer
    const { rows: referrerRows } = await q<{ id: string }>(
      "SELECT id FROM users WHERE referral_code = $1",
      [code.toUpperCase()]
    );
    if (!referrerRows[0]) throw new Error("Invalid referral code.");
    const referrerId = referrerRows[0].id;
    if (referrerId === userId) throw new Error("You cannot use your own referral code.");

    // Link referred_by on the user
    await q("UPDATE users SET referred_by = $1 WHERE id = $2", [referrerId, userId]);

    // Record the referral event
    const { randomUUID } = await import("crypto");
    await q(
      `INSERT INTO referrals (id, referrer_id, referred_id, rewarded, created_at)
       VALUES ($1, $2, $3, FALSE, NOW())
       ON CONFLICT DO NOTHING`,
      [randomUUID(), referrerId, userId]
    );

    // Reward: +5 reputation to referrer
    await q(
      "UPDATE users SET reputation_score = LEAST(reputation_score + 5, 100) WHERE id = $1",
      [referrerId]
    );
  });

  return NextResponse.json<ApiResponse<{ applied: true }>>({ success: true, data: { applied: true } });
}));
