import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminRemoveMember } from "@/server/services/admin.service";
import { logAuditAction } from "@/server/services/audit.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export const DELETE = withErrorHandler(
  withAdminAuth(async (req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string; memberId: string } };
    const session = await getServerSession(authOptions);
    const actorId = (session!.user as { id: string }).id;

    await adminRemoveMember(params.id, params.memberId);

    await logAuditAction(actorId, "REMOVE_MEMBER", "MEMBER", params.memberId, {
      details: { circleId: params.id },
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json<ApiResponse<{ success: true }>>({ success: true, data: { success: true } });
  })
);
