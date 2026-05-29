import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withErrorHandler } from "@/server/middleware";
import { resolveDispute, confirmContributionFromDispute } from "@/server/services/dispute.service";
import type { ApiResponse, Dispute } from "@/types";
import { z } from "zod";

const ResolveDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  status: z.enum(["resolved", "rejected"]),
  resolutionNotes: z.string().min(5).max(500),
  txHash: z.string().optional(),
  contributionId: z.string().uuid().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = ResolveDisputeSchema.parse(body);

  const dispute = await resolveDispute(
    parsed.disputeId,
    parsed.status,
    parsed.resolutionNotes,
    session.user.id
  );

  // If resolving as confirmed, update the contribution
  if (parsed.status === "resolved" && parsed.txHash && parsed.contributionId) {
    await confirmContributionFromDispute(parsed.disputeId, parsed.contributionId, parsed.txHash);
  }

  return NextResponse.json<ApiResponse<Dispute>>(
    { success: true, data: dispute },
    { status: 200 }
  );
});
