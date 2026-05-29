import { randomBytes, createHash } from "crypto";
import { query } from "./db";
import { getRedis } from "./redis";

const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes in seconds

/**
 * Generates a new refresh token and stores it in the database.
 * Returns the raw token (to be sent to client) and its hash (stored in DB).
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return token;
}

/**
 * Verifies a refresh token and returns the user ID if valid.
 * Does NOT revoke the token (that happens separately on use).
 */
export async function verifyRefreshToken(token: string): Promise<string | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const result = await query<{ user_id: string; revoked_at: string | null }>(
    `SELECT user_id, revoked_at FROM refresh_tokens
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );

  const tokenRecord = result.rows[0];
  if (!tokenRecord || tokenRecord.revoked_at) {
    return null; // Token not found, expired, or revoked
  }

  return tokenRecord.user_id;
}

/**
 * Revokes a refresh token by marking it as revoked.
 * Called after successfully using a token to issue a new one.
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1`,
    [tokenHash]
  );
}

/**
 * Revokes all refresh tokens for a user (used on logout).
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

/**
 * Cleans up expired refresh tokens from the database.
 * Should be run periodically via a cron job.
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await query<{ count: number }>(
    `DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING COUNT(*) as count`
  );

  return result.rows[0]?.count ?? 0;
}

/**
 * Gets token expiry times for JWT claims.
 */
export function getTokenExpiries(): {
  accessTokenExpires: number;
  refreshTokenExpires: number;
} {
  const now = Math.floor(Date.now() / 1000);
  return {
    accessTokenExpires: now + ACCESS_TOKEN_TTL,
    refreshTokenExpires: now + REFRESH_TOKEN_TTL,
  };
}

export { REFRESH_TOKEN_TTL, ACCESS_TOKEN_TTL };
