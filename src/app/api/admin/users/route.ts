import { NextRequest, NextResponse } from "next/server";
import { adminListUsers } from "@/server/services/admin.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export const GET = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    const search = new URL(req.url).searchParams.get("search") ?? undefined;
    const users = await adminListUsers(search);
    return NextResponse.json<ApiResponse<typeof users>>({ success: true, data: users });
  })
);
