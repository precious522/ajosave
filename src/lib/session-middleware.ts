/**
 * Middleware to track session activity on authenticated requests.
 * This should be called on API routes that require authentication.
 */
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { updateSessionActivity, hashToken, createSession } from "./sessions";

/**
 * Track session activity for authenticated requests
 * Call this in API routes after verifying authentication
 */
export async function trackSessionActivity(req: NextRequest): Promise<void> {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token?.sessionId) {
      return; // No session to track
    }

    // Hash the session ID to use as token hash
    const tokenHash = hashToken(token.sessionId as string);
    
    // Update last active timestamp
    await updateSessionActivity(tokenHash);
  } catch (error) {
    // Don't fail the request if session tracking fails
    console.error("[session-middleware] Failed to track session activity:", error);
  }
}

/**
 * Initialize session on login
 * Call this after successful authentication
 */
export async function initializeSession(
  req: NextRequest,
  userId: string,
  sessionId: string,
  expiresAt: Date
): Promise<void> {
  try {
    const tokenHash = hashToken(sessionId);
    await createSession(userId, tokenHash, req, expiresAt);
  } catch (error) {
    console.error("[session-middleware] Failed to initialize session:", error);
    throw error;
  }
}
