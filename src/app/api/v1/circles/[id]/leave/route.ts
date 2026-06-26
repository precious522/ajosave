import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { leaveCircle } from "@/server/services/circle.service";
import { withErrorHandler } from "@/server/middleware";

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const circleId = params.id;
    await leaveCircle(circleId, session.user.id);

    return NextResponse.json({
      success: true,
      message: "Successfully left the circle",
    });
  }
);
