import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCircleById, shuffleAndPersistPositions } from "@/server/services/circle.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse, Member } from "@/types";
import { randomBytes } from "crypto";

/**
 * POST /api/circles/[id]/shuffle
 * Randomizes payout positions for an open circle (creator only).
 * Generates a seed, persists shuffled positions to DB, and stores seed for verifiability.
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
      { success: false, error: "Only the circle creator can shuffle positions" },
      { status: 403 }
    );
  }

  if (circle.status !== "open") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Positions can only be shuffled before the circle starts" },
      { status: 400 }
    );
  }

  // Generate deterministic seed from current timestamp and random bytes
  const seed = `${Date.now()}-${randomBytes(16).toString("hex")}`;

  try {
    const shuffled = await shuffleAndPersistPositions(params.id, seed);
    return NextResponse.json<ApiResponse<Member[]>>({ success: true, data: shuffled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to shuffle positions";
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: message },
      { status: 400 }
    );
  }
});
