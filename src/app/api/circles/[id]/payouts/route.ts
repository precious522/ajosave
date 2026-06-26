import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export interface PayoutHistoryRow {
  id: string;
  cycleNumber: number;
  amountUsdc: string;
  txHash: string;
  paidAt: string;
  recipientName: string;
}

export const GET = withErrorHandler(async (
  _req: NextRequest,
  ctx: unknown
) => {
  const { id } = (ctx as { params: { id: string } }).params;

  const { rows } = await query<PayoutHistoryRow>(
    `SELECT
       p.id,
       p.cycle_number   AS "cycleNumber",
       p.amount_usdc    AS "amountUsdc",
       p.tx_hash        AS "txHash",
       p.paid_at        AS "paidAt",
       COALESCE(u.display_name, 'Unknown') AS "recipientName"
     FROM payouts p
     JOIN members m ON m.id = p.recipient_member_id
     JOIN users   u ON u.id = m.user_id
     WHERE p.circle_id = $1
     ORDER BY p.cycle_number ASC`,
    [id]
  );

  return NextResponse.json<ApiResponse<PayoutHistoryRow[]>>({ success: true, data: rows });
});
