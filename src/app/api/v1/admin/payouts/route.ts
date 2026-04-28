import { NextResponse } from "next/server";
import { adminListPayouts } from "@/server/services/admin.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";
import type { AdminPayoutRow } from "@/server/services/admin.service";

export const GET = withErrorHandler(
  withAdminAuth(async () => {
    const payouts = await adminListPayouts();
    return NextResponse.json<ApiResponse<AdminPayoutRow[]>>({ success: true, data: payouts });
  })
);
