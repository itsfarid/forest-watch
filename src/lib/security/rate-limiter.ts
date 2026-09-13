import { headers } from "next/headers";
import { RATE_LIMIT_DEFAULTS } from "@/lib/config/constants";

/**
 * In-memory sliding window rate limiter
 */
interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export class MemoryRateLimiter {
  private hits = new Map<string, RateLimitRecord>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(
    maxRequests: number = RATE_LIMIT_DEFAULTS.MAX_REQUESTS,
    windowMs: number = RATE_LIMIT_DEFAULTS.WINDOW_MS,
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a request from the given key is allowed under the sliding window limit.
   */
  public checkRateLimit(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let record = this.hits.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.hits.set(key, record);
    }

    // Filter out timestamps older than the sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= this.maxRequests) {
      const oldestTs = record.timestamps[0];
      const resetMs = oldestTs + this.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, resetMs),
      };
    }

    record.timestamps.push(now);
    const remaining = this.maxRequests - record.timestamps.length;
    return {
      allowed: true,
      remaining,
      resetMs: this.windowMs,
    };
  }

  /**
   * Clean up expired entries to avoid memory leaks.
   */
  public cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    this.hits.forEach((record, key) => {
      record.timestamps = record.timestamps.filter(
        (ts: number) => ts > windowStart,
      );
      if (record.timestamps.length === 0) {
        this.hits.delete(key);
      }
    });
  }

  /**
   * Reset rate limiter state (mainly for testing)
   */
  public reset(): void {
    this.hits.clear();
  }
}

// Global singleton instance for server actions
export const defaultRateLimiter = new MemoryRateLimiter();

/**
 * Extract client IP from Next.js server request headers.
 */
export function getClientIp(): string {
  try {
    const headerList = headers();
    const forwardedFor = headerList.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0].trim();
    }
    const realIp = headerList.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
  } catch {
    // headers() might be called outside Next.js request context (e.g. in tests)
  }
  return "127.0.0.1";
}
