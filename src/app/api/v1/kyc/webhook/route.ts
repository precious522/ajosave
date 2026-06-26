import { NextRequest, NextResponse } from "next/server";
import { handleKycWebhook, type SmileWebhookPayload } from "@/lib/kyc";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

/**
 * POST /api/v1/kyc/webhook
 * Receives KYC result callbacks from Smile Identity.
 * Verifies the HMAC signature and updates the user's kyc_status.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const payload = (await req.json()) as SmileWebhookPayload;

  if (!payload?.PartnerParams?.user_id || !payload.signature || !payload.timestamp) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid payload" },
      { status: 400 }
    );
  }

  const { userId, status } = await handleKycWebhook(payload);

  return NextResponse.json<ApiResponse<{ userId: string; status: string }>>({
    success: true,
    data: { userId, status },
  });
});
