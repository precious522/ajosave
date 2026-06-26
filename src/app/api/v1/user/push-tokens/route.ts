import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";
import { withSanitizedBody } from "@/server/middleware";
import type { ApiResponse } from "@/types";

const pushTokenSchema = z.object({
  token: z.string().min(1).max(512),
  platform: z.enum(["ios", "android", "web"]),
});

export type PushToken = {
  id: string;
  token: string;
  platform: "ios" | "android" | "web";
  createdAt: string;
  updatedAt: string;
};

export const POST = withSanitizedBody(async (
  req: NextRequest
): Promise<NextResponse<ApiResponse<PushToken>>> => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = pushTokenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { token, platform } = parsed.data;
    const { rows } = await query<{
      id: string;
      token: string;
      platform: "ios" | "android" | "web";
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO push_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, token, platform) DO UPDATE
       SET updated_at = NOW()
       RETURNING id, token, platform, created_at, updated_at`,
      [session.user.id, token, platform]
    );

    if (!rows[0]) {
      throw new Error("Failed to register push token");
    }

    const row = rows[0];
    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        token: row.token,
        platform: row.platform,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register push token";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});

export const DELETE = withSanitizedBody(async (
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = pushTokenSchema.pick({ token: true }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { token } = parsed.data;
    await query(
      `DELETE FROM push_tokens WHERE user_id = $1 AND token = $2`,
      [session.user.id, token]
    );

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete push token";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
