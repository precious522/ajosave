import { NextRequest, NextResponse } from "next/server";
import { getCurrentBaseFee, calculatePriorityFee } from "@/lib/stellar";
import { serverConfig } from "@/server/config";
import type { ApiResponse } from "@/types";

export async function GET(_req: NextRequest) {
  const baseFee = await getCurrentBaseFee();
  const priorityFee = calculatePriorityFee(baseFee);

  return NextResponse.json<ApiResponse<{ baseFee: number; priorityFee: number; maxFeeCap: number }>>({
    success: true,
    data: {
      baseFee,
      priorityFee,
      maxFeeCap: serverConfig.stellar.maxFeeCap,
    },
  });
}
