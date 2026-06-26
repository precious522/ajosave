import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import { getAuditLogs, getAuditLogCount } from "@/server/services/audit.service";
import type { ApiResponse } from "@/types";
import type { AuditLogResponse } from "@/server/services/audit.service";

interface AuditLogsListResponse {
  logs: AuditLogResponse[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * GET /api/v1/admin/audit-logs
 * Retrieves audit logs with optional filtering (admin only).
 * 
 * Query Parameters:
 * - actorId: Filter by admin user ID
 * - action: Filter by action type (TRIGGER_PAYOUT, REMOVE_MEMBER, DELETE_USER, etc)
 * - targetType: Filter by target type (CIRCLE, MEMBER, USER, PAYOUT)
 * - targetId: Filter by target ID
 * - startDate: Filter by start date (ISO 8601)
 * - endDate: Filter by end date (ISO 8601)
 * - limit: Number of results per page (default: 100, max: 1000)
 * - offset: Pagination offset (default: 0)
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "logs": [...],
 *     "total": 150,
 *     "limit": 100,
 *     "offset": 0
 *   }
 * }
 */
export const GET = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    const url = new URL(req.url);
    const params = url.searchParams;

    // Parse query parameters
    const actorId = params.get("actorId") || undefined;
    const action = (params.get("action") as any) || undefined;
    const targetType = (params.get("targetType") as any) || undefined;
    const targetId = params.get("targetId") || undefined;
    const startDateStr = params.get("startDate");
    const endDateStr = params.get("endDate");
    const limit = Math.min(parseInt(params.get("limit") || "100"), 1000);
    const offset = parseInt(params.get("offset") || "0");

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid startDate format. Use ISO 8601 (e.g., 2024-01-01T00:00:00Z)" },
        { status: 400 }
      );
    }

    if (endDate && isNaN(endDate.getTime())) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid endDate format. Use ISO 8601 (e.g., 2024-01-01T00:00:00Z)" },
        { status: 400 }
      );
    }

    // Fetch logs and count
    const logs = await getAuditLogs({
      actorId,
      action,
      targetType,
      targetId,
      startDate,
      endDate,
      limit,
      offset,
    });

    const total = await getAuditLogCount({
      actorId,
      action,
      targetType,
      targetId,
      startDate,
      endDate,
    });

    return NextResponse.json<ApiResponse<AuditLogsListResponse>>(
      {
        success: true,
        data: {
          logs,
          total,
          limit,
          offset,
        },
      },
      { status: 200 }
    );
  })
);
