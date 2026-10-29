import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let warnedAboutDatabaseFallback = false;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function hashedBucketKey(request: Request, routeKey: string) {
  return createHash("sha256").update(`${routeKey}:${clientIp(request)}`).digest("hex");
}

function localRateLimit(key: string, limit: number, windowMs: number) {
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

export async function rateLimit(request: Request, routeKey: string, limit: number, windowMs: number) {
  const key = hashedBucketKey(request, routeKey);
  const { data, error } = await supabaseAdmin.rpc("consume_api_rate_limit", {
    target_bucket_key: key,
    max_requests: limit,
    window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
  });

  if (!error) {
    const result = (data as { allowed: boolean; retry_after_ms: number }[] | null)?.[0];
    if (result) {
      return result.allowed
        ? { ok: true as const }
        : { ok: false as const, retryAfterMs: Number(result.retry_after_ms) };
    }
  }

  if (!warnedAboutDatabaseFallback) {
    warnedAboutDatabaseFallback = true;
    console.warn("[rate-limit] contador compartilhado indisponivel; usando fallback local", error?.message);
  }

  return localRateLimit(key, limit, windowMs);
}
