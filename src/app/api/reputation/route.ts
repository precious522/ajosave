import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateReputation, getReputation } from "@/server/services/reputation.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse, ReputationScore } from "@/types";

// GET /api/reputation — fetch current user's score
export const GET = withErrorHandler(async (_req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const userId = (session.user as { id: string }).id;
  const record = await getReputation(userId);
  return NextResponse.json<ApiResponse<ReputationScore | null>>({
    success: true,
    data: record,
  });
});

// POST /api/reputation — recalculate score from contribution history
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { onTimeContributions = 0, circlesCompleted = 0, defaults = 0, stellarTxProof } = body;

  const userId = (session.user as { id: string }).id;
  const record = await calculateReputation(
    userId,
    Number(onTimeContributions),
    Number(circlesCompleted),
    Number(defaults),
    stellarTxProof
  );

  return NextResponse.json<ApiResponse<ReputationScore>>({ success: true, data: record });
});
