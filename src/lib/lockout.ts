import { getRedis } from "./redis";

const MAX_FAILURES = 5;
const FAILURE_WINDOW = 10 * 60; // 10 minutes in seconds
const LOCKOUT_DURATION = 30 * 60; // 30 minutes in seconds

export interface LockoutStatus {
  isLocked: boolean;
  attempts: number;
  remainingAttempts: number;
  lockoutExpiresAt?: number; // Unix timestamp in seconds
  lockoutRemainingSeconds?: number; // Seconds until lockout expires
}

/**
 * Checks if a phone number is currently locked out and returns detailed status.
 */
export async function getLockoutStatus(phone: string): Promise<LockoutStatus> {
  const redis = await getRedis();
  const lockoutKey = `lockout:${phone}`;
  const attemptsKey = `otp_failures:${phone}`;

  // Check if locked out
  const lockoutValue = await redis.get(lockoutKey);
  if (lockoutValue) {
    const ttl = await redis.ttl(lockoutKey);
    const lockoutExpiresAt = Math.floor(Date.now() / 1000) + ttl;
    return {
      isLocked: true,
      attempts: MAX_FAILURES,
      remainingAttempts: 0,
      lockoutExpiresAt,
      lockoutRemainingSeconds: ttl,
    };
  }

  // Get current attempt count
  const attemptsStr = await redis.get(attemptsKey);
  const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
  const remainingAttempts = Math.max(0, MAX_FAILURES - attempts);

  return {
    isLocked: false,
    attempts,
    remainingAttempts,
  };
}

/**
 * Checks if a phone number is currently locked out (boolean).
 */
export async function isLockedOut(phone: string): Promise<boolean> {
  const status = await getLockoutStatus(phone);
  return status.isLocked;
}

/**
 * Increments the failure count for a phone number.
 * Locks the account if failures exceed MAX_FAILURES.
 * Returns the updated lockout status.
 */
export async function recordFailure(phone: string): Promise<LockoutStatus> {
  const redis = await getRedis();
  const attemptsKey = `otp_failures:${phone}`;
  const lockoutKey = `lockout:${phone}`;

  const failures = await redis.incr(attemptsKey);
  if (failures === 1) {
    await redis.expire(attemptsKey, FAILURE_WINDOW);
  }

  if (failures >= MAX_FAILURES) {
    await redis.set(lockoutKey, "1", { EX: LOCKOUT_DURATION });
    await redis.del(attemptsKey);
    
    const lockoutExpiresAt = Math.floor(Date.now() / 1000) + LOCKOUT_DURATION;
    return {
      isLocked: true,
      attempts: MAX_FAILURES,
      remainingAttempts: 0,
      lockoutExpiresAt,
      lockoutRemainingSeconds: LOCKOUT_DURATION,
    };
  }

  const remainingAttempts = Math.max(0, MAX_FAILURES - failures);
  return {
    isLocked: false,
    attempts: failures,
    remainingAttempts,
  };
}

/**
 * Resets failure counts and lockout state for a phone number.
 */
export async function resetLockout(phone: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(`otp_failures:${phone}`);
  await redis.del(`lockout:${phone}`);
}

export { MAX_FAILURES, FAILURE_WINDOW, LOCKOUT_DURATION };
