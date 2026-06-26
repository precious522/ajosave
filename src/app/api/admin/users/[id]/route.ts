import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { adminSoftDeleteUser } from "@/server/services/admin.service";
import { logAuditAction } from "@/server/services/audit.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import { getRequestContext } from "@/lib/request-context";
import { authOptions } from "@/lib/auth";
import type { ApiResponse } from "@/types";

/**
 * DELETE /api/admin/users/[id]
 * Soft-deletes a user (admin only).
 * 
 * Logs: DELETE_USER action to audit trail
 */
export const DELETE = withErrorHandler(
  withAdminAuth(async (req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string } };
    const session = await getServerSession(authOptions);
    const actorId = (session?.user as { id?: string })?.id;

    await adminSoftDeleteUser(params.id);

    // Log the audit action
    if (actorId) {
      const requestContext = getRequestContext(req);
      await logAuditAction(actorId, "DELETE_USER", "USER", params.id, {
        details: {
          reason: "Admin soft delete",
        },
        ...requestContext,
      });
    }

    return NextResponse.json<ApiResponse<null>>({ success: true, data: null });
  })
);
