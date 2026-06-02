import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  startEventIndexer,
  stopEventIndexer,
  getIndexerStatus,
  pollOnce,
} from "@/server/services/event-indexer.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

/** GET /api/v1/admin/event-indexer — return current status */
export const GET = withErrorHandler(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json<ApiResponse<never>>({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json<ApiResponse<ReturnType<typeof getIndexerStatus>>>({
    success: true,
    data: getIndexerStatus(),
  });
});

/** POST /api/v1/admin/event-indexer — start | stop | poll */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json<ApiResponse<never>>({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { action } = (await req.json()) as { action: "start" | "stop" | "poll" };

  if (action === "start") {
    startEventIndexer();
    return NextResponse.json<ApiResponse<{ message: string }>>({ success: true, data: { message: "Indexer started" } });
  }
  if (action === "stop") {
    stopEventIndexer();
    return NextResponse.json<ApiResponse<{ message: string }>>({ success: true, data: { message: "Indexer stopped" } });
  }
  if (action === "poll") {
    const count = await pollOnce();
    return NextResponse.json<ApiResponse<{ processed: number }>>({ success: true, data: { processed: count } });
  }

  return NextResponse.json<ApiResponse<never>>(
    { success: false, error: "Invalid action. Use start | stop | poll" },
    { status: 400 }
  );
});
