import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { getWaitlistStatus } from "@/server/services/waitlist.service";
import { withErrorHandler, withRateLimit } from "@/server/middleware";
import type { ApiResponse, Circle, Member } from "@/types";

export const GET = withRateLimit(withErrorHandler(async (_req: NextRequest, ctx: unknown) => {
  const { params } = ctx as { params: { id: string } };
  const circle = await getCircleById(params.id);
  if (!circle) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Circle not found" },
      { status: 404 }
    );
  }
  const circleMembers = await getMembersByCircle(params.id);

  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string } | undefined;
  let waitlist = { isOnWaitlist: false, position: null as number | null };
  if (user?.id) {
    waitlist = await getWaitlistStatus(params.id, user.id);
  }

  return NextResponse.json<ApiResponse<{ circle: Circle; members: Member[]; waitlist: typeof waitlist }>>({
    success: true,
    data: { circle, members: circleMembers, waitlist },
  });
}));
