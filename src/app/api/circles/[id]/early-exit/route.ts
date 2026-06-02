import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withErrorHandler } from "@/server/middleware";
import { requestEarlyExit } from "@/server/services/early-exit.service";
import type { ApiResponse, EarlyExitRequest } from "@/types";
import { z } from "zod";

const Schema = z.object({
  penaltyPercent: z.number().min(0).max(100).optional(),
});

export const POST = withErrorHandler(async (req: NextRequest, ctx: unknown) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { params } = ctx as { params: { id: string } };
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.parse(body);

  const exitRequest = await requestEarlyExit(
    params.id,
    session.user.id,
    parsed.penaltyPercent
  );

  return NextResponse.json<ApiResponse<EarlyExitRequest>>(
    { success: true, data: exitRequest },
    { status: 201 }
  );
});
