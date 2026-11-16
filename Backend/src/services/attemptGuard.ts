interface Entry {
  failures: number;
  lockedUntil: number;
  lastFailureAt: number;
}

export interface AttemptGuard {
  /** Seconds the key is still locked for, or 0 when it may try. */
  lockedFor(key: string): number;
  /** Record a failed attempt; returns the lock time in seconds if this failure tripped the lock. */
  fail(key: string): number;
  /** Forget a key after a success. */
  reset(key: string): void;
}

/**
 * Brute-force protection per account/order (not per IP): after `maxFailures` wrong tries the key is
 * locked for `lockMs`. Lives in memory, which is exactly right for a single long-running Render instance.
 */
export const createAttemptGuard = (maxFailures: number, lockMs: number): AttemptGuard => {
  const entries = new Map<string, Entry>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.lockedUntil <= now && now - entry.lastFailureAt >= lockMs) entries.delete(key);
    }
  }, 60_000).unref();

  return {
    lockedFor(key) {
      const entry = entries.get(key);
      const remaining = entry ? entry.lockedUntil - Date.now() : 0;
      return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    },
    fail(key) {
      const now = Date.now();
      const entry = entries.get(key) ?? { failures: 0, lockedUntil: 0, lastFailureAt: now };
      // A stale streak (older than the lock period) starts over
      if (now - entry.lastFailureAt >= lockMs) entry.failures = 0;
      entry.failures += 1;
      entry.lastFailureAt = now;
      if (entry.failures >= maxFailures) {
        entry.lockedUntil = now + lockMs;
        entry.failures = 0;
      }
      entries.set(key, entry);
      return entry.lockedUntil > now ? Math.ceil(lockMs / 1000) : 0;
    },
    reset(key) {
      entries.delete(key);
    },
  };
};

/** Several guards as one: the longest lock wins and every failure counts toward each of them. */
const combineGuards = (...guards: AttemptGuard[]): AttemptGuard => ({
  lockedFor: (key) => Math.max(...guards.map((guard) => guard.lockedFor(key))),
  fail: (key) => Math.max(...guards.map((guard) => guard.fail(key))),
  reset: (key) => guards.forEach((guard) => guard.reset(key)),
});

// One guard per credential type, so a locked login never blocks OTP entry and vice versa.
export const loginAttempts = createAttemptGuard(5, 15 * 60_000);
export const adminLoginAttempts = createAttemptGuard(5, 15 * 60_000);
// Email codes are only 4 digits (1 in 10,000): besides the 15-minute lock after 5 misses, 10 misses in a
// day lock the address for 24 hours, so guessing a password-reset code stays impractical.
export const otpAttempts = combineGuards(createAttemptGuard(5, 15 * 60_000), createAttemptGuard(10, 24 * 60 * 60_000));
export const riderLoginAttempts = createAttemptGuard(5, 15 * 60_000);
export const deliveryOtpAttempts = createAttemptGuard(5, 15 * 60_000);

const sendTimes = new Map<string, number>();
const SEND_COOLDOWN_MS = 30_000;

setInterval(() => {
  const cutoff = Date.now() - SEND_COOLDOWN_MS;
  for (const [key, at] of sendTimes) if (at <= cutoff) sendTimes.delete(key);
}, 60_000).unref();

/** Returns true (and starts the cooldown) if an OTP email may go out to this address right now. */
export const claimOtpSend = (email: string): boolean => {
  const last = sendTimes.get(email);
  if (last !== undefined && Date.now() - last < SEND_COOLDOWN_MS) return false;
  sendTimes.set(email, Date.now());
  return true;
};
