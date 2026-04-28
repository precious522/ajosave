import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCircleSchema } from "@/types/schemas";
import { createCircle, listOpenCircles, getCirclesByUser } from "@/server/services/circle.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse, Circle } from "@/types";
import type { PaginatedCircles } from "@/server/services/circle.service";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");

  if (filter === "mine") {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const userId = (session.user as { id: string }).id;
    const circles = await getCirclesByUser(userId);
    return NextResponse.json<ApiResponse<Circle[]>>({ success: true, data: circles });
  }

  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  
  const frequency = searchParams.get("frequency") as any;
  const minAmount = searchParams.get("minAmount") ? parseInt(searchParams.get("minAmount")!, 10) : undefined;
  const maxAmount = searchParams.get("maxAmount") ? parseInt(searchParams.get("maxAmount")!, 10) : undefined;
  const currency = searchParams.get("currency") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const result = await listOpenCircles(page, limit, {
    frequency,
    minAmount,
    maxAmount,
    currency,
    search,
  });
  return NextResponse.json<ApiResponse<PaginatedCircles>>({ success: true, data: result });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const parsed = createCircleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const userId = (session.user as { id: string }).id;
  const circle = await createCircle(userId, parsed.data);
  return NextResponse.json<ApiResponse<Circle>>({ success: true, data: circle }, { status: 201 });
});
