import { createHmac, timingSafeEqual } from "crypto";
import { serverConfig } from "@/server/config";

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes — replay window

/**
 * Compute HMAC-SHA256 signature for an internal request.
 * Signature covers: "<timestamp>.<METHOD>.<path>"
 */
export function computeSignature(secret: string, timestamp: string, method: string, path: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${method.toUpperCase()}.${path}`)
    .digest("hex");
}

/**
 * Build headers for a signed internal request.
 *
 * Usage (e.g. cron caller):
 *   const headers = signRequest("GET", "/api/v1/cron/cycle");
 *   await fetch(url, { headers });
 */
export function signRequest(method: string, path: string): Record<string, string> {
  const secret = serverConfig.cronSecret;
  if (!secret) throw new Error("CRON_SECRET is not configured");
  const timestamp = Date.now().toString();
  const signature = computeSignature(secret, timestamp, method, path);
  return { "x-signature": signature, "x-timestamp": timestamp };
}

/**
 * Verify HMAC-SHA256 signature on an incoming internal request.
 * Accepts any object with { method, url, headers.get() } — compatible with NextRequest.
 *
 * Returns null on success, or an error string on failure.
 */
export function verifySignature(req: {
  method: string;
  url: string;
  headers: { get(name: string): string | null };
}): string | null {
  const secret = serverConfig.cronSecret;
  if (!secret) return "CRON_SECRET not configured";

  const timestamp = req.headers.get("x-timestamp");
  const signature = req.headers.get("x-signature");
  if (!timestamp || !signature) return "missing headers";

  const age = Math.abs(Date.now() - parseInt(timestamp, 10));
  if (isNaN(age) || age > TIMESTAMP_TOLERANCE_MS) return "timestamp out of range";

  const { pathname } = new URL(req.url);
  const expected = computeSignature(secret, timestamp, req.method, pathname);

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature.padEnd(64, "0").slice(0, 64), "hex");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return "signature mismatch";
  }

  return null;
}

// ── Next.js wrapper ────────────────────────────────────────────────────────────
// Imported lazily so the pure functions above are testable without next/server.

/**
 * Verify HMAC signature on a NextRequest. Returns a 401 NextResponse on failure,
 * or null on success. Drop-in replacement for the old Bearer-token verifyCronSecret.
 */
export async function verifyCronSecret(req: import("next/server").NextRequest): Promise<import("next/server").NextResponse | null> {
  const { NextResponse } = await import("next/server");
  const err = verifySignature(req);
  if (err) {
    console.error("[cron-auth] rejected:", err);
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
