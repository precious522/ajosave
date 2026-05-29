import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelCircle } from "@/server/services/circle.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse, Circle } from "@/types";

export const POST = withErrorHandler(async (_req: NextRequest, ctx: unknown) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { params } = ctx as { params: { id: string } };
  const userId = (session.user as { id: string }).id;

  try {
    const circle = await cancelCircle(params.id, userId);
    return NextResponse.json<ApiResponse<Circle>>({ success: true, data: circle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel circle";
    const status =
      message === "Circle not found" ? 404 :
      message === "Only the creator can cancel a circle" ? 403 : 400;
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: message },
      { status }
    );
  }
});
