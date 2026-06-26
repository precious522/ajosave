import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import { query } from "@/lib/db";
import { processCyclePayout } from "@/server/services/payout.service";
import type { ApiResponse, Payout } from "@/types";

export const POST = withErrorHandler(
  withAdminAuth(async (_req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string } };

    const { rows } = await query<{ circle_id: string; cycle_number: number; status: string; recipient_stellar_key: string | null }>(
      `SELECT p.circle_id, p.cycle_number, p.status,
              u.stellar_public_key AS recipient_stellar_key
       FROM payouts p
       JOIN members m ON m.id = p.recipient_member_id
       JOIN users u ON u.id = m.user_id
       WHERE p.id = $1`,
      [params.id]
    );
    const row = rows[0];
    if (!row) return NextResponse.json<ApiResponse<never>>({ success: false, error: "Payout not found" }, { status: 404 });
    if (row.status !== "failed") return NextResponse.json<ApiResponse<never>>({ success: false, error: "Only failed payouts can be retried" }, { status: 400 });

    // Reset retry count so it gets full retries again
    await query("UPDATE payouts SET retry_count = 0, status = 'pending' WHERE id = $1", [params.id]);

    const payout = await processCyclePayout(row.circle_id, row.recipient_stellar_key ?? "");
    return NextResponse.json<ApiResponse<Payout>>({ success: true, data: payout });
  })
);
