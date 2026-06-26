import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUsdcBalance } from "@/lib/stellar";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<{ balance: string; hasTrustline: boolean }>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = req.nextUrl.searchParams.get("publicKey");
  if (!publicKey || !/^G[A-Z2-7]{55}$/.test(publicKey)) {
    return NextResponse.json({ success: false, error: "Invalid Stellar public key" }, { status: 400 });
  }

  const data = await getUsdcBalance(publicKey);
  return NextResponse.json({ success: true, data });
}
