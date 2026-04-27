import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { toggleSmsNotifications } from "@/server/services/notification.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ enabled: boolean }>>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Invalid request: enabled must be a boolean" },
        { status: 400 }
      );
    }

    await toggleSmsNotifications(session.user.id, enabled);

    return NextResponse.json({ 
      success: true, 
      data: { enabled } 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update SMS preferences";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
