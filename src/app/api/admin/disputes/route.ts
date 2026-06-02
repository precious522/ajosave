import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import { resolveDispute, confirmContributionFromDispute, updateDisputeStatus, getAllDisputes } from "@/server/services/dispute.service";
import type { ApiResponse, Dispute } from "@/types";
import { z } from "zod";

const ResolveDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  status: z.enum(["investigating", "resolved", "rejected"]),
  resolutionNotes: z.string().min(5).max(500).optional(),
  txHash: z.string().optional(),
  contributionId: z.string().uuid().optional(),
});

export const GET = withErrorHandler(
  withAdminAuth(async () => {
    const disputes = await getAllDisputes();
    return NextResponse.json<ApiResponse<Dispute[]>>({ success: true, data: disputes });
  })
);

export const POST = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const parsed = ResolveDisputeSchema.parse(body);

    const dispute = parsed.status === "investigating"
      ? await updateDisputeStatus(parsed.disputeId, "investigating")
      : await resolveDispute(
          parsed.disputeId,
          parsed.status,
          parsed.resolutionNotes ?? "",
          (session?.user as { id: string }).id
        );

    if (parsed.status === "resolved" && parsed.txHash && parsed.contributionId) {
      await confirmContributionFromDispute(parsed.disputeId, parsed.contributionId, parsed.txHash);
    }

    return NextResponse.json<ApiResponse<Dispute>>({ success: true, data: dispute }, { status: 200 });
  })
);
