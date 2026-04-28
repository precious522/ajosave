import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { joinCircleSchema } from "@/types/schemas";
import { joinCircle, getCircleById } from "@/server/services/circle.service";
import { withErrorHandler } from "@/server/middleware";
import { verifyInviteToken } from "@/lib/tokens";
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

  const { token } = parsed.data;
  const circle = await getCircleById(params.id);
  if (!circle) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Circle not found" },
      { status: 404 }
    );
  }

  let isInvited = false;
  if (circle.circleType === "private") {
    if (!token) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invite token is required for private circles" },
        { status: 403 }
      );
    }
    const decoded = await verifyInviteToken(token);
    if (!decoded || decoded.circleId !== params.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid or expired invite token" },
        { status: 403 }
      );
    }
    isInvited = true;
  } else if (token) {
    // Also check token for public circles if provided
    const decoded = await verifyInviteToken(token);
    if (decoded && decoded.circleId === params.id) {
      isInvited = true;
    }
  }

  const userId = (session.user as { id: string }).id;
  const member = await joinCircle(params.id, userId, isInvited);
  return NextResponse.json<ApiResponse<Member>>({ success: true, data: member }, { status: 201 });
});
