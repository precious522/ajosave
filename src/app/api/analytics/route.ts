import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export interface PlatformStats {
  totalCircles: number;
  activeCircles: number;
  completedCircles: number;
  totalUsdcDistributed: string;
  totalMembers: number;
  avgCircleSize: number;
  avgCycleDurationDays: number;
}

export const GET = withErrorHandler(async () => {
  const { rows } = await query<PlatformStats>(`
    SELECT
      COUNT(*)::int                                                   AS "totalCircles",
      COUNT(*) FILTER (WHERE status = 'active')::int                 AS "activeCircles",
      COUNT(*) FILTER (WHERE status = 'completed')::int              AS "completedCircles",
      COALESCE(
        (SELECT SUM(amount_usdc)::text FROM payouts), '0'
      )                                                               AS "totalUsdcDistributed",
      COALESCE(
        (SELECT COUNT(*)::int FROM members WHERE status = 'active'), 0
      )                                                               AS "totalMembers",
      ROUND(AVG(max_members))::int                                    AS "avgCircleSize",
      ROUND(AVG(
        CASE cycle_frequency
          WHEN 'weekly'   THEN 7
          WHEN 'biweekly' THEN 14
          WHEN 'monthly'  THEN 30
        END
      ))::int                                                         AS "avgCycleDurationDays"
    FROM circles
  `);

  return NextResponse.json<ApiResponse<PlatformStats>>({ success: true, data: rows[0] });
});
