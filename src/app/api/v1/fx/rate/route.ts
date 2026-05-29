import { NextResponse, NextRequest } from "next/server";
import { getFiatPerUsdc } from "@/lib/fx";
import type { ApiResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const currency = req.nextUrl.searchParams.get("currency") || "NGN";
  
  try {
    const rate = await getFiatPerUsdc(currency);
    return NextResponse.json<ApiResponse<{ rate: number; currency: string; fetchedAt: string }>>({
      success: true,
      data: { rate, currency, fetchedAt: new Date().toISOString() },
    });
  } catch (err) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: `Failed to fetch FX rate for ${currency}` },
      { status: 500 }
    );
  }
}
