import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import { approveEarlyExit, rejectEarlyExit } from "@/server/services/early-exit.service";
import type { ApiResponse, EarlyExitRequest } from "@/types";
import { z } from "zod";

const Schema = z.object({
  exitRequestId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

export const POST = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    const body = await req.json();
    const { exitRequestId, action } = Schema.parse(body);

    const result =
      action === "approve"
        ? await approveEarlyExit(exitRequestId)
        : await rejectEarlyExit(exitRequestId);

    return NextResponse.json<ApiResponse<EarlyExitRequest>>({ success: true, data: result });
  })
);
