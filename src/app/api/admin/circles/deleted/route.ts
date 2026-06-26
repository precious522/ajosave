import { NextResponse } from "next/server";
import { adminListDeletedCircles } from "@/server/services/admin.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";
import type { AdminCircleRow } from "@/server/services/admin.service";

export const GET = withErrorHandler(
  withAdminAuth(async () => {
    const circles = await adminListDeletedCircles();
    return NextResponse.json<ApiResponse<AdminCircleRow[]>>({ success: true, data: circles });
  })
);
