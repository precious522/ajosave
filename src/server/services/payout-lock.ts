/**
 * In-process mutex for serializing Stellar payout operations.
 *
 * Prevents concurrent payouts from racing on the same account sequence number.
 * In a multi-instance deployment, replace with a distributed lock (e.g. Redis SET NX).
 */

const locks = new Set<string>();

export class PayoutLockError extends Error {
  constructor(circleId: string) {
    super(`Payout already in progress for circle ${circleId}`);
    this.name = "PayoutLockError";
  }
}

/**
 * Acquire a lock for the given key, run fn, then release.
 * Throws PayoutLockError immediately if the lock is already held.
 */
export async function withPayoutLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (locks.has(key)) throw new PayoutLockError(key);
  locks.add(key);
  try {
    return await fn();
  } finally {
    locks.delete(key);
  }
}
