/**
 * Session management utilities for tracking and managing user sessions.
 * Sessions are stored in the database and linked to JWT tokens.
 */
import { query } from "./db";
import { createHash } from "crypto";
import type { NextRequest } from "next/server";

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionInfo {
  id: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

/**
 * Hash a JWT token for storage (we don't store raw tokens)
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Parse user agent string to extract device info
 */
export function parseUserAgent(userAgent: string): {
  deviceType: string;
  browser: string;
  os: string;
  deviceName: string;
} {
  const ua = userAgent.toLowerCase();

  // Device type detection
  let deviceType = "desktop";
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
    deviceType = "tablet";
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) {
    deviceType = "mobile";
  }

  // Browser detection
  let browser = "Unknown";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("safari/") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("opera/") || ua.includes("opr/")) browser = "Opera";

  // OS detection
  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  // Device name (friendly description)
  const deviceName = `${browser} on ${os}`;

  return { deviceType, browser, os, deviceName };
}

/**
 * Extract IP address from request, considering proxies
 */
export function getIpAddress(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  
  return "unknown";
}

/**
 * Create a new session record in the database
 */
export async function createSession(
  userId: string,
  tokenHash: string,
  req: NextRequest,
  expiresAt: Date
): Promise<string> {
  const userAgent = req.headers.get("user-agent") || "Unknown";
  const ipAddress = getIpAddress(req);
  const { deviceType, browser, os, deviceName } = parseUserAgent(userAgent);

  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (
      user_id, token_hash, device_name, device_type, browser, os, 
      ip_address, user_agent, last_active_at, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
    RETURNING id`,
    [userId, tokenHash, deviceName, deviceType, browser, os, ipAddress, userAgent, expiresAt]
  );

  return rows[0].id;
}

/**
 * Update session last active timestamp
 */
export async function updateSessionActivity(tokenHash: string): Promise<void> {
  await query(
    "UPDATE sessions SET last_active_at = NOW() WHERE token_hash = $1",
    [tokenHash]
  );
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  const { rows } = await query<{
    id: string;
    device_name: string | null;
    device_type: string | null;
    browser: string | null;
    os: string | null;
    ip_address: string | null;
    last_active_at: Date;
    created_at: Date;
  }>(
    `SELECT id, device_name, device_type, browser, os, ip_address, 
            last_active_at, created_at
     FROM sessions
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY last_active_at DESC`,
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    deviceName: row.device_name || "Unknown Device",
    deviceType: row.device_type || "unknown",
    browser: row.browser || "Unknown",
    os: row.os || "Unknown",
    ipAddress: row.ip_address || "Unknown",
    lastActiveAt: row.last_active_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    isCurrent: false, // Will be set by the caller
  }));
}

/**
 * Get session by token hash
 */
export async function getSessionByTokenHash(tokenHash: string): Promise<Session | null> {
  const { rows } = await query<Session>(
    `SELECT id, user_id, token_hash, device_name, device_type, browser, os,
            ip_address, user_agent, last_active_at, created_at, expires_at
     FROM sessions
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );

  return rows[0] || null;
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(
    "DELETE FROM sessions WHERE id = $1 AND user_id = $2",
    [sessionId, userId]
  );

  return (rowCount ?? 0) > 0;
}

/**
 * Revoke all sessions for a user except the current one
 */
export async function revokeAllOtherSessions(
  userId: string,
  currentSessionId: string
): Promise<number> {
  const { rowCount } = await query(
    "DELETE FROM sessions WHERE user_id = $1 AND id != $2",
    [userId, currentSessionId]
  );

  return rowCount ?? 0;
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  const { rowCount } = await query(
    "DELETE FROM sessions WHERE user_id = $1",
    [userId]
  );

  return rowCount ?? 0;
}

/**
 * Clean up expired sessions (should be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const { rowCount } = await query(
    "DELETE FROM sessions WHERE expires_at < NOW()"
  );

  return rowCount ?? 0;
}
