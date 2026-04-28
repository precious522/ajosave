import { NextRequest, NextResponse } from "next/server";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse, Circle, Member } from "@/types";

export const GET = withErrorHandler(async (_req: NextRequest, ctx: unknown) => {
  const { params } = ctx as { params: { id: string } };
  const circle = await getCircleById(params.id);
  if (!circle) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Circle not found" },
      { status: 404 }
    );
  }
  const circleMembers = await getMembersByCircle(params.id);
  return NextResponse.json<ApiResponse<{ circle: Circle; members: Member[] }>>({
    success: true,
    data: { circle, members: circleMembers },
  });
});
