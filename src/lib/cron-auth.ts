import { NextRequest, NextResponse } from "next/server";
import { serverConfig } from "@/server/config";

/**
 * Verify the Authorization: Bearer <CRON_SECRET> header on a cron request.
 *
 * Returns a 401 response when:
 *  - CRON_SECRET is not configured (empty string)
 *  - The Authorization header is absent
 *  - The token does not match CRON_SECRET
 *
 * Returns null when the request is authenticated, allowing the caller to proceed.
 *
 * Usage:
 *   const unauth = verifyCronSecret(req);
 *   if (unauth) return unauth;
 */
export function verifyCronSecret(req: NextRequest): NextResponse | null {
  const secret = serverConfig.cronSecret;

  // Fail closed: if the secret is not configured, reject all requests.
  // This prevents accidental open access when the env var is missing.
  if (!secret) {
    console.error("[cron-auth] CRON_SECRET is not set — rejecting request");
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7) // more precise than .replace("Bearer ", "")
    : null;

  if (!token || token !== secret) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null; // authenticated
}
