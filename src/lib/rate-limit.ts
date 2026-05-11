import { headers } from "next/headers";

const MAX_STORE_SIZE = 10000;
const windows = new Map<string, Map<string, { count: number; resetAt: number }>>();

function getIpFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(retryAfterSeconds: number) {
    super("RATE_LIMITED");
    this.name = "RateLimitError";
    this.retryAfter = retryAfterSeconds;
  }
}

interface RateLimitOptions {
  name: string;
  maxRequests: number;
  windowSeconds: number;
}

// MAX_STORE_SIZE moved out
function checkRateLimit(ip: string, opts: RateLimitOptions): void {
  const now = Date.now();
  const windowMs = opts.windowSeconds * 1000;

  let store = windows.get(opts.name);
  if (!store) {
    store = new Map();
    windows.set(opts.name, store);
  }

  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return;
  }

  entry.count++;

  if (entry.count > opts.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    throw new RateLimitError(retryAfter);
  }
}

/** Rate limit using the incoming Request (mobile routes, login, etc.) */
export function rateLimit(request: Request, opts: RateLimitOptions): void {
  checkRateLimit(getIpFromHeaders(request.headers), opts);
}

/** Rate limit for web routes that don't have a Request object (uses next/headers) */
export async function rateLimitWeb(opts: RateLimitOptions): Promise<void> {
  const h = await headers();
  checkRateLimit(getIpFromHeaders(h), opts);
}

// Garbage collect expired entries every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const store of windows.values()) {
      for (const [key, entry] of store) {
        if (now > entry.resetAt) store.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}
