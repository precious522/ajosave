import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  startHorizonStream,
  stopHorizonStream,
  getStreamStatus,
} from "@/server/services/horizon-stream.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

/**
 * GET /api/admin/horizon-stream
 * Get Horizon stream status
 */
export const GET = withErrorHandler(async (_req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // TODO: Add admin role check
  // if (session.user.role !== 'admin') {
  //   return NextResponse.json<ApiResponse<never>>(
  //     { success: false, error: "Forbidden" },
  //     { status: 403 }
  //   );
  // }

  const status = getStreamStatus();

  return NextResponse.json<ApiResponse<{ running: boolean }>>({
    success: true,
    data: status,
  });
});

/**
 * POST /api/admin/horizon-stream
 * Start or stop the Horizon stream
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // TODO: Add admin role check

  const body = await req.json();
  const { action } = body as { action: "start" | "stop" };

  if (action === "start") {
    await startHorizonStream();
    return NextResponse.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: "Horizon stream started" },
    });
  } else if (action === "stop") {
    stopHorizonStream();
    return NextResponse.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: "Horizon stream stopped" },
    });
  } else {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid action. Use 'start' or 'stop'" },
      { status: 400 }
    );
  }
});
