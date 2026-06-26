import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getReputationStats, verifyReputation } from "@/lib/reputation";
import { query } from "@/lib/db";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

/**
 * GET /api/users/[id]/reputation
 * Fetch on-chain reputation for a user
 */
export const GET = withErrorHandler(async (_req: NextRequest, ctx: unknown) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { params } = ctx as { params: { id: string } };
  const { searchParams } = new URL(_req.url);
  const verify = searchParams.get("verify") === "true";

  // Fetch user's Stellar address
  const { rows } = await query<{ stellar_public_key: string | null }>(
    "SELECT stellar_public_key FROM users WHERE id = $1",
    [params.id]
  );

  if (rows.length === 0) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "User not found" },
      { status: 404 }
    );
  }

  const stellarAddress = rows[0].stellar_public_key;
  if (!stellarAddress) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "User has no Stellar address" },
      { status: 400 }
    );
  }

  // Fetch on-chain reputation stats
  const stats = await getReputationStats(stellarAddress);

  // Optionally verify against database
  let isVerified: boolean | undefined;
  if (verify) {
    isVerified = await verifyReputation(params.id, stellarAddress);
  }

  return NextResponse.json<
    ApiResponse<{
      score: number;
      circlesCompleted: number;
      onTimeContributions: number;
      totalContributions: number;
      isVerified?: boolean;
    }>
  >({
    success: true,
    data: {
      ...stats,
      ...(verify && { isVerified }),
    },
  });
});
