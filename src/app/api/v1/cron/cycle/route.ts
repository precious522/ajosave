import { NextRequest, NextResponse } from "next/server";
import { processDueCycles } from "@/server/services/scheduler.service";
import { verifyCronSecret } from "@/lib/cron-auth";
import type { ApiResponse } from "@/types";

export const GET = async (req: NextRequest) => {
  const unauth = verifyCronSecret(req);
  if (unauth) return unauth;

  await processDueCycles();
  return NextResponse.json<ApiResponse<{ message: string }>>({
    success: true,
    data: { message: "Cycle check complete" },
  });
};
