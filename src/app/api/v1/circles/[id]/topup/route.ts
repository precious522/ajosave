import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { initializePayment } from "@/lib/paystack";
import { serverConfig } from "@/server/config";
import { withErrorHandler } from "@/server/middleware";
import { query } from "@/lib/db";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const bodySchema = z.object({
  amountFiat: z.number().positive(),
});

/**
 * POST /api/v1/circles/:id/topup
 * Pay the remaining balance on a partial contribution for the current cycle.
 */
export const POST = withErrorHandler(async (req: NextRequest, ctx: unknown) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { params } = ctx as { params: { id: string } };
  const circle = await getCircleById(params.id);
  if (!circle) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Circle not found" },
      { status: 404 }
    );
  }

  const circleMembers = await getMembersByCircle(params.id);
  const userId = (session.user as { id: string; email?: string }).id;
  const member = circleMembers.find((m) => m.userId === userId);
  if (!member) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "You are not a member of this circle" },
      { status: 403 }
    );
  }

  const rawBody = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  // Fetch existing partial contribution
  const { rows } = await query<{
    id: string;
    amount_usdc: string;
    amount_paid_usdc: string;
    status: string;
  }>(
    `SELECT id, amount_usdc, amount_paid_usdc, status
     FROM contributions WHERE member_id = $1 AND cycle_number = $2 LIMIT 1`,
    [member.id, circle.currentCycle]
  );

  if (!rows[0]) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "No contribution found for this cycle. Use the contribute endpoint first." },
      { status: 404 }
    );
  }

  if (rows[0].status === "confirmed") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Contribution already fully paid" },
      { status: 400 }
    );
  }

  const fullUsdc = parseFloat(rows[0].amount_usdc);
  const paidUsdc = parseFloat(rows[0].amount_paid_usdc);
  const remainingUsdc = fullUsdc - paidUsdc;

  if (remainingUsdc <= 0) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "No remaining balance to top up" },
      { status: 400 }
    );
  }

  const fullFiat = circle.contributionFiat;
  // Cap top-up at remaining balance
  const remainingFiat = (remainingUsdc / fullUsdc) * fullFiat;
  const topUpFiat = Math.min(parsed.data.amountFiat, remainingFiat);
  const topUpUsdc = ((topUpFiat / fullFiat) * fullUsdc).toFixed(7);

  const reference = `ajo-topup-${params.id}-${member.id}-${circle.currentCycle}-${Date.now()}`;
  const callbackUrl = `${serverConfig.app.url}/circles/${params.id}/contribute/callback?reference=${reference}`;

  const { authorizationUrl } = await initializePayment({
    email: (session.user as { email?: string }).email ?? `${userId}@ajosave.app`,
    amount: topUpFiat,
    currency: circle.contributionCurrency,
    reference,
    callbackUrl,
    metadata: {
      circleId: params.id,
      memberId: member.id,
      cycleNumber: circle.currentCycle,
      isTopUp: true,
      topUpUsdc,
      contributionId: rows[0].id,
    },
  });

  // Store the top-up reference so the webhook can credit it
  await query(
    `UPDATE contributions
     SET paystack_reference = $1, authorization_url = $2, updated_at = NOW()
     WHERE id = $3`,
    [reference, authorizationUrl, rows[0].id]
  );

  return NextResponse.json<ApiResponse<{ authorizationUrl: string; reference: string; remainingUsdc: string; topUpUsdc: string }>>({
    success: true,
    data: {
      authorizationUrl,
      reference,
      remainingUsdc: remainingUsdc.toFixed(7),
      topUpUsdc,
    },
  });
});
