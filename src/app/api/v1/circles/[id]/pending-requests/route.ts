import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPendingJoinRequests, getCircleById } from "@/server/services/circle.service";
import type { ApiResponse, Member } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<Member[]>>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const circleId = params.id;
    const circle = await getCircleById(circleId);
    
    if (!circle) {
      return NextResponse.json(
        { success: false, error: "Circle not found" },
        { status: 404 }
      );
    }

    // Only circle creator can view pending requests
    if (circle.creatorId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Only the circle creator can view pending requests" },
        { status: 403 }
      );
    }

    const pendingRequests = await getPendingJoinRequests(circleId);
    return NextResponse.json({ success: true, data: pendingRequests });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch pending requests";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
