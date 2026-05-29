import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { joinCircleSchema } from "@/types/schemas";
import { joinCircle } from "@/server/services/circle.service";
import { getReputation } from "@/server/services/reputation.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse, Member } from "@/types";

export const POST = withErrorHandler(async (req: NextRequest, ctx: unknown) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { params } = ctx as { params: { id: string } };
  const body = await req.json();
  const parsed = joinCircleSchema.safeParse({ ...body, circleId: params.id });
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const userId = (session.user as { id: string }).id;

  // Optional reputation filter: if minReputation is specified, enforce it
  const minReputation = body.minReputation ? Number(body.minReputation) : null;
  if (minReputation !== null) {
    const rep = await getReputation(userId);
    const userScore = rep?.score ?? 0;
    if (userScore < minReputation) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Minimum reputation score of ${minReputation} required (yours: ${userScore})` },
        { status: 403 }
      );
    }
  }

  const member = await joinCircle(params.id, userId);
  return NextResponse.json<ApiResponse<Member>>({ success: true, data: member }, { status: 201 });
});
