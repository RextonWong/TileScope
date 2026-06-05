interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

let pruneScheduled = false;
function schedulePrune() {
  if (pruneScheduled) return;
  pruneScheduled = true;
  setTimeout(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (now > bucket.resetAt) store.delete(key);
    }
    pruneScheduled = false;
  }, 60_000);
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec?: number;
}

export function checkRateLimit(
  key: string,
  max = 20,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  schedulePrune();

  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= max) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { ok: true };
}

export function clientIp(req: Request): string {
  const xff = (req.headers as Headers).get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (req.headers as Headers).get("x-real-ip") ?? "anonymous";
}
