import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withErrorHandler } from "@/server/middleware";
import { deleteUserData, sendDeletionConfirmationEmail } from "@/server/services/user-deletion.service";
import type { ApiResponse } from "@/types";

export const DELETE = withErrorHandler(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = (session.user as { id: string }).id;
  const { email } = await deleteUserData(userId);

  if (email) {
    await sendDeletionConfirmationEmail(email).catch(() => {});
  }

  return NextResponse.json<ApiResponse<{ deleted: true }>>({ success: true, data: { deleted: true } });
});
