import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revokeSession } from "@/lib/sessions";
import type { ApiResponse } from "@/types";

/**
 * DELETE /api/v1/sessions/:sessionId
 * Revoke a specific session
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
): Promise<NextResponse<ApiResponse<{ revoked: boolean }>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId } = params;

    // Revoke the session
    const revoked = await revokeSession(sessionId, session.user.id);

    if (!revoked) {
      return NextResponse.json(
        { success: false, error: "Session not found or already revoked" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { revoked: true },
    });
  } catch (error) {
    console.error("[sessions] Error revoking session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke session" },
      { status: 500 }
    );
  }
}
