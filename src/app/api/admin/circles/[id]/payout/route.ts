import { NextRequest, NextResponse } from "next/server";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { processCyclePayout, PayoutLockError } from "@/server/services/payout.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse, Payout } from "@/types";

/**
 * POST /api/admin/circles/[id]/payout
 * Manually trigger a payout cycle for a circle (admin only).
 * Requires the circle to be active and the next recipient to have a Stellar key.
 */
export const POST = withErrorHandler(
  withAdminAuth(async (_req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string } };

    const circle = await getCircleById(params.id);
    if (!circle) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Circle not found" },
        { status: 404 }
      );
    }
    if (circle.status !== "active") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Circle is not active" },
        { status: 400 }
      );
    }

    const members = await getMembersByCircle(params.id);
    const recipient = members.find((m) => m.position === circle.currentCycle);
    if (!recipient) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "No recipient found for current cycle" },
        { status: 400 }
      );
    }

    try {
      // recipientStellarKey is resolved inside processCyclePayout via the contract path,
      // or passed here for the Horizon fallback. We pass empty string for contract circles.
      const payout = await processCyclePayout(params.id, "");
      return NextResponse.json<ApiResponse<Payout>>({ success: true, data: payout });
    } catch (err) {
      if (err instanceof PayoutLockError) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Payout already in progress for this circle" },
          { status: 409 }
        );
      }
      throw err;
    }
  })
);
