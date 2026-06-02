import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withErrorHandler } from "@/server/middleware";
import { getDisputesByCircle, createDispute } from "@/server/services/dispute.service";
import { getCircleById } from "@/server/services/circle.service";
import type { ApiResponse, Dispute } from "@/types";
import { z } from "zod";

const CreateDisputeSchema = z.object({
  contributionId: z.string().uuid().optional(),
  memberId: z.string().uuid(),
  type: z.enum(["missed_payout", "wrong_amount", "other"]).default("other"),
  reason: z.string().min(10).max(500),
  evidence: z.string().max(1000).optional(),
  paystackReference: z.string().optional(),
});

export const GET = withErrorHandler(async (_req: NextRequest, ctx: unknown) => {
  const { params } = ctx as { params: { id: string } };
  const circle = await getCircleById(params.id);
  if (!circle) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Circle not found" },
      { status: 404 }
    );
  }
  const disputes = await getDisputesByCircle(params.id);
  return NextResponse.json<ApiResponse<Dispute[]>>({
    success: true,
    data: disputes,
  });
});

export const POST = withErrorHandler(async (req: NextRequest, ctx: unknown) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { params } = ctx as { params: { id: string } };
  const body = await req.json();
  const parsed = CreateDisputeSchema.parse(body);

  const dispute = await createDispute(
    parsed.contributionId,
    parsed.memberId,
    params.id,
    parsed.reason,
    parsed.type,
    parsed.evidence,
    parsed.paystackReference
  );

  return NextResponse.json<ApiResponse<Dispute>>(
    { success: true, data: dispute },
    { status: 201 }
  );
});
