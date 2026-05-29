import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { processCyclePayout, PayoutLockError } from "@/server/services/payout.service";
import { logAuditAction } from "@/server/services/audit.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import { getRequestContext } from "@/lib/request-context";
import { authOptions } from "@/lib/auth";
import type { ApiResponse, Payout } from "@/types";

/**
 * POST /api/admin/circles/[id]/payout
 * Manually trigger a payout cycle for a circle (admin only).
 * Requires the circle to be active and the next recipient to have a Stellar key.
 * 
 * Logs: TRIGGER_PAYOUT action to audit trail
 */
export const POST = withErrorHandler(
  withAdminAuth(async (req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string } };
    const session = await getServerSession(authOptions);
    const actorId = (session?.user as { id?: string })?.id;

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

      // Log the audit action
      if (actorId) {
        const requestContext = getRequestContext(req);
        await logAuditAction(actorId, "TRIGGER_PAYOUT", "PAYOUT", params.id, {
          details: {
            circleName: circle.name,
            recipientMemberId: recipient.id,
            cycle: circle.currentCycle,
            amountUsdc: payout.amountUsdc,
            txHash: payout.txHash,
          },
          ...requestContext,
        });
      }

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
