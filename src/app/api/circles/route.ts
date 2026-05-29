import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCircleSchema } from "@/types/schemas";
import { createCircle, listOpenCircles, getCirclesByUser } from "@/server/services/circle.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse, Circle } from "@/types";

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

  const circles = await listOpenCircles(filter === "mine" ? undefined : searchParams.get("category") ?? undefined);
  return NextResponse.json<ApiResponse<Circle[]>>({ success: true, data: circles });
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
