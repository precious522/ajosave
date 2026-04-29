import { NextRequest, NextResponse } from "next/server";
import { sendOtp } from "@/lib/sms";
import { withRateLimit, withErrorHandler } from "@/server/middleware";
import { sendOtpSchema } from "@/types/schemas";
import type { ApiResponse } from "@/types";
import { getRedis } from "@/lib/redis";
import { isLockedOut } from "@/lib/lockout";

// 5 OTP requests per IP per 10 minutes; X-RateLimit-* headers returned on every response
export const POST = withRateLimit(
  withErrorHandler(async (req: NextRequest) => {
    const body = await req.json();
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { phone } = parsed.data;

    // Check for account lockout (brute-force protection)
    if (await isLockedOut(phone)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Account locked due to too many failed attempts. Please try again in 30 minutes." },
        { status: 423 }
      );
    }

    const otp = await sendOtp(phone);

    // Store OTP in Redis with 10-minute expiry
    const redis = await getRedis();
    await redis.set(`otp:${phone}`, otp, { EX: 600 });

    if (process.env.NODE_ENV === "development") console.warn(`[DEV] OTP for ${phone}: ${otp}`);

    return NextResponse.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: "OTP sent successfully" },
    });
  }),
  { limit: 5, windowMs: 10 * 60 * 1000 }
);
