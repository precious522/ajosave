import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserReputation } from "@/server/services/reputation.service";
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
  const score = await getUserReputation(userId);
  const record: ReputationScore = {
    userId,
    score,
    onTimeContributions: 0,
    circlesCompleted: 0,
    defaults: 0,
    lastUpdated: new Date(),
  };
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
  const { onTimeContributions = 0, circlesCompleted = 0, defaults = 0 } = body;

  const userId = (session.user as { id: string }).id;
  // Simple calculation for now
  const score = Math.min(100, Math.max(0, (onTimeContributions * 5) + (circlesCompleted * 10) - (defaults * 20)));
  
  const record: ReputationScore = {
    userId,
    score,
    onTimeContributions: Number(onTimeContributions),
    circlesCompleted: Number(circlesCompleted),
    defaults: Number(defaults),
    lastUpdated: new Date(),
  };

  return NextResponse.json<ApiResponse<ReputationScore>>({ success: true, data: record });
});
