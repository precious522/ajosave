import { NextRequest, NextResponse } from "next/server";
import { adminListCircles } from "@/server/services/admin.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";
import type { AdminCircleRow } from "@/server/services/admin.service";

export const GET = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    const includeDeleted = new URL(req.url).searchParams.get("includeDeleted") === "true";
    const circles = await adminListCircles(includeDeleted);
    return NextResponse.json<ApiResponse<AdminCircleRow[]>>({ success: true, data: circles });
  })
);
