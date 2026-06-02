import { NextRequest, NextResponse } from "next/server";
import { getDailyAnalytics, adminGetPerCircleAnalytics, getSmsDeliveryStats } from "@/server/services/analytics.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export const GET = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    const [dailyAnalytics, circleAnalytics, smsDelivery] = await Promise.all([
      getDailyAnalytics(),
      adminGetPerCircleAnalytics(),
      getSmsDeliveryStats(),
    ]);

    return NextResponse.json<ApiResponse<{ dailyAnalytics: typeof dailyAnalytics; circleAnalytics: typeof circleAnalytics; smsDelivery: typeof smsDelivery }>>({
      success: true,
      data: {
        dailyAnalytics,
        circleAnalytics,
        smsDelivery,
      },
    });
  })
);
