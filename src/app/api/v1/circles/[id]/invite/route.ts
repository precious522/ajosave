import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCircleById } from "@/server/services/circle.service";
import { createInviteToken } from "@/lib/tokens";
import { withErrorHandler } from "@/server/middleware";
import { serverConfig } from "@/server/config";
import type { ApiResponse } from "@/types";

export const GET = withErrorHandler(async (req: NextRequest, ctx: unknown) => {
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
      { success: false, error: "Only the circle creator can generate invite links" },
      { status: 403 }
    );
  }

  const token = await createInviteToken(circle.id);
  const inviteUrl = `${serverConfig.app.url}/circles/${circle.id}/join?token=${token}`;

  return NextResponse.json<ApiResponse<{ inviteUrl: string }>>({
    success: true,
    data: { inviteUrl },
  });
});
