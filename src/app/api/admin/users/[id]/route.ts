import { NextRequest, NextResponse } from "next/server";
import { adminSoftDeleteUser } from "@/server/services/admin.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export const DELETE = withErrorHandler(
  withAdminAuth(async (_req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string } };
    await adminSoftDeleteUser(params.id);
    return NextResponse.json<ApiResponse<null>>({ success: true, data: null });
  })
);
