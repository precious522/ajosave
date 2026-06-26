import { NextRequest } from "next/server";

/**
 * Extracts client IP address from request headers.
 * Checks X-Forwarded-For, X-Real-IP, and falls back to connection info.
 */
export function getClientIp(req: NextRequest): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to connection IP if available
  return req.ip || undefined;
}

/**
 * Extracts user agent from request headers.
 */
export function getUserAgent(req: NextRequest): string | undefined {
  return req.headers.get("user-agent") || undefined;
}

/**
 * Gets both IP and user agent from request.
 */
export function getRequestContext(req: NextRequest): {
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  };
}
