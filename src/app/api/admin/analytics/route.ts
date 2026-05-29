import { NextRequest, NextResponse } from "next/server";
import { getDailyAnalytics, adminGetPerCircleAnalytics } from "@/server/services/analytics.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export const GET = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    const dailyAnalytics = await getDailyAnalytics();
    const circleAnalytics = await adminGetPerCircleAnalytics();

    return NextResponse.json<ApiResponse<{ dailyAnalytics: typeof dailyAnalytics; circleAnalytics: typeof circleAnalytics }>>({
      success: true,
      data: {
        dailyAnalytics,
        circleAnalytics,
      },
    });
  })
);
