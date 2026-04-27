import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";
import type { ApiError } from "@/types";
import { getRedis } from "@/lib/redis";

type Handler = (_req: NextRequest, _ctx?: unknown) => Promise<NextResponse>;

export function withAuth(handler: Handler): Handler {
  return async (req, ctx) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json<ApiError>(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    return handler(req, ctx);
  };
}

export function withAdminAuth(handler: Handler): Handler {
  return async (req, ctx) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json<ApiError>(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    const role = (session.user as { role?: string }).role;
    if (role !== "admin") {
      return NextResponse.json<ApiError>(
        { success: false, error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    return handler(req, ctx);
  };
}

export function withErrorHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      Sentry.captureException(err, { extra: { url: req.url, method: req.method } });
      console.error("[API Error]", err);
      return NextResponse.json<ApiError>(
        { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  };
}

/**
 * Redis sliding-window rate limiter.
 * Returns { allowed, remaining, resetAt } so callers can set X-RateLimit-* headers.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = await getRedis();
  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `rl:${key}`;

  // Sliding window: remove old entries, add current timestamp, count
  await redis.zRemRangeByScore(redisKey, 0, windowStart);
  const count = await redis.zCard(redisKey);

  if (count >= limit) {
    const oldest = await redis.zRange(redisKey, 0, 0, { BY: "SCORE" });
    const resetAt = oldest[0] ? parseInt(oldest[0]) + windowMs : now + windowMs;
    return { allowed: false, remaining: 0, resetAt };
  }

  await redis.zAdd(redisKey, { score: now, value: String(now) });
  await redis.pExpire(redisKey, windowMs);
  return { allowed: true, remaining: limit - count - 1, resetAt: now + windowMs };
}

/**
 * Middleware wrapper that enforces rate limiting and sets X-RateLimit-* headers.
 */
export function withRateLimit(
  handler: Handler,
  { limit = 60, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): Handler {
  return async (req, ctx) => {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const routeKey = new URL(req.url).pathname;
    const result = await rateLimit(`${routeKey}:${ip}`, limit, windowMs);

    if (!result.allowed) {
      return NextResponse.json<ApiError>(
        { success: false, error: "Too many requests", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
            "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const response = await handler(req, ctx);
    response.headers.set("X-RateLimit-Limit", String(limit));
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
    return response;
  };
}
