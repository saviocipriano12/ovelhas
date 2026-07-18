import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export function rateLimit(request: Request, routeKey: string, limit: number, windowMs: number) {
  const key = `${routeKey}:${clientIp(request)}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const };
  }

  if (bucket.count >= limit) {
    return { ok: false as const, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true as const };
}
