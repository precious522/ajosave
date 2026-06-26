import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initiateKyc } from "@/lib/kyc";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

/**
 * POST /api/v1/kyc/verify
 * Initiates a KYC session for the authenticated user.
 * Returns a Smile Identity web-token the client passes to the widget SDK.
 */
export const POST = withErrorHandler(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = (session.user as { id: string }).id;
  const { token } = await initiateKyc(userId);

  return NextResponse.json<ApiResponse<{ token: string }>>({
    success: true,
    data: { token },
  });
});
