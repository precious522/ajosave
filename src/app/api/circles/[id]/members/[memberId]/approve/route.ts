import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { approveJoinRequest } from "@/server/services/circle.service";
import { sendSms } from "@/lib/sms";
import type { ApiResponse, Member } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
): Promise<NextResponse<ApiResponse<Member>>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: circleId, memberId } = params;
    const member = await approveJoinRequest(circleId, memberId, session.user.id);

    // TODO: Send SMS notification to approved user
    // await sendSms(member.userId, "Your join request has been approved!");

    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve join request";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
