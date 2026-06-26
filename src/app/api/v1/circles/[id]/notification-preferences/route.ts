import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";
import { withSanitizedBody } from "@/server/middleware";
import type { ApiResponse } from "@/types";

const updatePreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

export type CircleNotificationPreferences = {
  id: string;
  userId: string;
  circleId: string;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<CircleNotificationPreferences>>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: circleId } = params;

    // Get or create preferences
    const { rows } = await query<{
      id: string;
      user_id: string;
      circle_id: string;
      push_enabled: boolean;
      sms_enabled: boolean;
      email_enabled: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO circle_notification_preferences (user_id, circle_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, circle_id) DO NOTHING
       RETURNING id, user_id, circle_id, push_enabled, sms_enabled, email_enabled, created_at, updated_at`,
      [session.user.id, circleId]
    );

    if (rows.length === 0) {
      // If not created, fetch existing
      const { rows: existingRows } = await query<{
        id: string;
        user_id: string;
        circle_id: string;
        push_enabled: boolean;
        sms_enabled: boolean;
        email_enabled: boolean;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT * FROM circle_notification_preferences WHERE user_id = $1 AND circle_id = $2`,
        [session.user.id, circleId]
      );
      if (!existingRows[0]) {
        throw new Error("Failed to get notification preferences");
      }
      return NextResponse.json({
        success: true,
        data: {
          id: existingRows[0].id,
          userId: existingRows[0].user_id,
          circleId: existingRows[0].circle_id,
          pushEnabled: existingRows[0].push_enabled,
          smsEnabled: existingRows[0].sms_enabled,
          emailEnabled: existingRows[0].email_enabled,
          createdAt: existingRows[0].created_at,
          updatedAt: existingRows[0].updated_at,
        },
      });
    }

    const row = rows[0];
    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        userId: row.user_id,
        circleId: row.circle_id,
        pushEnabled: row.push_enabled,
        smsEnabled: row.sms_enabled,
        emailEnabled: row.email_enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get notification preferences";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export const PATCH = withSanitizedBody(async (
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<CircleNotificationPreferences>>> => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: circleId } = params;
    const body = await req.json();
    const parsed = updatePreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { pushEnabled, smsEnabled, emailEnabled } = parsed.data;

    // Upsert preferences
    const { rows } = await query<{
      id: string;
      user_id: string;
      circle_id: string;
      push_enabled: boolean;
      sms_enabled: boolean;
      email_enabled: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO circle_notification_preferences (user_id, circle_id, push_enabled, sms_enabled, email_enabled)
       VALUES ($1, $2, COALESCE($3, true), COALESCE($4, true), COALESCE($5, true))
       ON CONFLICT (user_id, circle_id) DO UPDATE
       SET push_enabled = COALESCE($3, circle_notification_preferences.push_enabled),
           sms_enabled = COALESCE($4, circle_notification_preferences.sms_enabled),
           email_enabled = COALESCE($5, circle_notification_preferences.email_enabled),
           updated_at = NOW()
       RETURNING id, user_id, circle_id, push_enabled, sms_enabled, email_enabled, created_at, updated_at`,
      [session.user.id, circleId, pushEnabled ?? null, smsEnabled ?? null, emailEnabled ?? null]
    );

    if (!rows[0]) {
      throw new Error("Failed to update notification preferences");
    }

    const row = rows[0];
    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        userId: row.user_id,
        circleId: row.circle_id,
        pushEnabled: row.push_enabled,
        smsEnabled: row.sms_enabled,
        emailEnabled: row.email_enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update notification preferences";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
