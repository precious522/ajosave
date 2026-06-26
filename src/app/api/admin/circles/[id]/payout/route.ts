import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminGetPayoutRecipientKey } from "@/server/services/admin.service";
import { processCyclePayout } from "@/server/services/payout.service";
import { logAuditAction } from "@/server/services/audit.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse, Payout } from "@/types";

export const POST = withErrorHandler(
  withAdminAuth(async (req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string } };
    const session = await getServerSession(authOptions);
    const actorId = (session!.user as { id: string }).id;

    const recipient = await adminGetPayoutRecipientKey(params.id);
    if (!recipient) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Cannot trigger payout: circle is not active, or the next recipient has no Stellar key on file.",
        },
        { status: 400 }
      );
    }

    const payout = await processCyclePayout(params.id, recipient.stellarPublicKey);

    await logAuditAction(actorId, "TRIGGER_PAYOUT", "PAYOUT", payout.id, {
      details: {
        circleId: params.id,
        cycleNumber: recipient.cycleNumber,
        recipientName: recipient.recipientName,
        amountUsdc: payout.amountUsdc,
        txHash: payout.txHash,
      },
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json<ApiResponse<Payout>>({ success: true, data: payout }, { status: 200 });
  })
);
