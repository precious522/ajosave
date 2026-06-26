import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { withErrorHandler } from "@/server/middleware";
import { invokeContractSetPayoutOrder } from "@/lib/soroban";
import type { ApiResponse } from "@/types";

/**
 * POST /api/circles/[id]/sync-payout-order
 * Syncs randomized payout order from DB to smart contract (admin/creator only).
 * Must be called after shuffle and before circle starts.
 */
export const POST = withErrorHandler(async (_req: NextRequest, ctx: unknown) => {
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

  const userId = (session.user as { id: string }).id;
  if (circle.creatorId !== userId) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Only the circle creator can sync payout order" },
      { status: 403 }
    );
  }

  if (circle.status !== "open") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Payout order can only be synced before the circle starts" },
      { status: 400 }
    );
  }

  if (circle.payoutMethod !== "randomized") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Circle is not using randomized payout method" },
      { status: 400 }
    );
  }

  if (!circle.contractId) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Circle does not have a deployed smart contract" },
      { status: 400 }
    );
  }

  try {
    const members = await getMembersByCircle(params.id);
    
    // Build payout order: map member positions to their indices in the members array
    // Members are sorted by position, so we need to find the original join order
    const membersByJoinOrder = [...members].sort((a, b) => 
      new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    );
    
    const payoutOrder = members.map((m) => {
      const joinIndex = membersByJoinOrder.findIndex((jm) => jm.id === m.id);
      return joinIndex;
    });

    // Sync to smart contract
    await invokeContractSetPayoutOrder(circle.contractId, payoutOrder);

    return NextResponse.json<ApiResponse<{ payoutOrder: number[] }>>(
      { success: true, data: { payoutOrder } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync payout order";
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: message },
      { status: 400 }
    );
  }
});
