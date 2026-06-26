import { NextRequest, NextResponse } from "next/server";
import { adminGetCircleMemberContributions } from "@/server/services/admin.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";
import type { MemberContributionStatus } from "@/server/services/admin.service";

export const GET = withErrorHandler(
  withAdminAuth(async (_req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string } };
    const data = await adminGetCircleMemberContributions(params.id);
    return NextResponse.json<ApiResponse<MemberContributionStatus[]>>({ success: true, data });
  })
);
