import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/paystack";
import { withErrorHandler } from "@/server/middleware";
import { notifyContributionReceived } from "@/server/services/notification.service";
import { getCircleById } from "@/server/services/circle.service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { ApiResponse } from "@/types";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Missing reference" },
      { status: 400 }
    );
  }

  const result = await verifyPayment(reference);
  
  // Send SMS confirmation if payment was successful
  if (result.status === "success") {
    const session = await getServerSession(authOptions);
    const circleId = req.nextUrl.searchParams.get("circleId");
    const cycleNumber = req.nextUrl.searchParams.get("cycleNumber");
    
    if (session?.user?.id && circleId && cycleNumber) {
      const circle = await getCircleById(circleId);
      if (circle) {
        // Send notification (async, don't block)
        notifyContributionReceived(
          session.user.id,
          circle.name,
          circle.contributionUsdc,
          parseInt(cycleNumber)
        ).catch(err => {
          console.error("Failed to send contribution confirmation:", err);
        });
      }
    }
  }
  
  return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
});
