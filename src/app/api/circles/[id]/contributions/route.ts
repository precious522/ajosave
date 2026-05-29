import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export interface ContributionRow {
  id: string;
  cycleNumber: number;
  amountUsdc: string;
  status: string;
  createdAt: string;
  memberName: string;
  memberId: string;
}

export const GET = withErrorHandler(async (req: NextRequest, ctx: unknown) => {
  const { id } = (ctx as { params: { id: string } }).params;
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  const { rows } = await query<ContributionRow>(
    `SELECT
       c.id,
       c.cycle_number      AS "cycleNumber",
       c.amount_usdc      AS "amountUsdc",
       c.status           AS "status",
       c.created_at       AS "createdAt",
       COALESCE(u.display_name, 'Unknown') AS "memberName",
       m.id               AS "memberId"
     FROM contributions c
     JOIN members m ON m.id = c.member_id
     JOIN users u ON u.id = m.user_id
     WHERE c.circle_id = $1
     ORDER BY c.created_at DESC
     LIMIT $2 OFFSET $3`,
    [id, limit, offset]
  );

  const { rows: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM contributions WHERE circle_id = $1`,
    [id]
  );
  const total = parseInt(countRows[0]?.count ?? "0", 10);

  return NextResponse.json<ApiResponse<{ data: ContributionRow[]; total: number; page: number; limit: number }>>({
    success: true,
    data: { data: rows, total, page, limit },
  });
});
