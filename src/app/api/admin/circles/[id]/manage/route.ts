import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import { updateCircleStatus, getCircleById } from "@/server/services/circle.service";
import type { ApiResponse, Circle } from "@/types";
import { z } from "zod";

const Schema = z.object({
  action: z.enum(["pause", "close"]),
});

export const POST = withErrorHandler(
  withAdminAuth(async (req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string } };
    const body = await req.json();
    const { action } = Schema.parse(body);

    const circle = await getCircleById(params.id);
    if (!circle) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Circle not found" },
        { status: 404 }
      );
    }

    if (action === "pause") {
      if (circle.status !== "active") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Only active circles can be paused" },
          { status: 400 }
        );
      }
      await updateCircleStatus(params.id, "paused");
    } else {
      if (circle.status === "completed" || circle.status === "cancelled") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Circle is already closed" },
          { status: 400 }
        );
      }
      await updateCircleStatus(params.id, "cancelled");
    }

    const updated = await getCircleById(params.id);
    return NextResponse.json<ApiResponse<Circle>>({ success: true, data: updated! });
  })
);
