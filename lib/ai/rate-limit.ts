/**
 * Simple in-memory rate limiter for AI endpoints.
 * In production, use Redis or a database for persistence across instances.
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
  lastRequestAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

const DAILY_LIMIT = 20;
const COOLDOWN_MS = 15 * 1000; // 15 seconds between requests
const DAY_MS = 24 * 60 * 60 * 1000;

export type RateLimitResult = {
  allowed: boolean;
  reason?: "daily_limit" | "cooldown";
  remainingDaily?: number;
  cooldownSecondsLeft?: number;
};

export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  // No entry - first request
  if (!entry) {
    rateLimitStore.set(userId, {
      count: 1,
      resetAt: now + DAY_MS,
      lastRequestAt: now,
    });
    return { allowed: true, remainingDaily: DAILY_LIMIT - 1 };
  }

  // Reset if day has passed
  if (now > entry.resetAt) {
    rateLimitStore.set(userId, {
      count: 1,
      resetAt: now + DAY_MS,
      lastRequestAt: now,
    });
    return { allowed: true, remainingDaily: DAILY_LIMIT - 1 };
  }

  // Check cooldown
  const timeSinceLastRequest = now - entry.lastRequestAt;
  if (timeSinceLastRequest < COOLDOWN_MS) {
    const cooldownSecondsLeft = Math.ceil((COOLDOWN_MS - timeSinceLastRequest) / 1000);
    return {
      allowed: false,
      reason: "cooldown",
      cooldownSecondsLeft,
      remainingDaily: DAILY_LIMIT - entry.count,
    };
  }

  // Check daily limit
  if (entry.count >= DAILY_LIMIT) {
    return {
      allowed: false,
      reason: "daily_limit",
      remainingDaily: 0,
    };
  }

  // Allow and increment
  entry.count += 1;
  entry.lastRequestAt = now;
  rateLimitStore.set(userId, entry);

  return { allowed: true, remainingDaily: DAILY_LIMIT - entry.count };
}

// Cleanup old entries periodically (run this in production with a cron job)
export function cleanupOldEntries(): void {
  const now = Date.now();
  for (const [userId, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(userId);
    }
  }
}
