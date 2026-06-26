import { NextResponse } from "next/server";
import { adminGetPlatformStats } from "@/server/services/admin.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export const GET = withErrorHandler(
  withAdminAuth(async () => {
    const stats = await adminGetPlatformStats();
    return NextResponse.json<ApiResponse<typeof stats>>({ success: true, data: stats });
  })
);
