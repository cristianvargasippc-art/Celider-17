const buckets = new Map();

export function rateLimit({ key, limit, max, windowMs }) {
  const effectiveLimit = limit ?? max;
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: bucket.count <= effectiveLimit,
    remaining: Math.max(0, effectiveLimit - bucket.count),
    resetAt: bucket.resetAt
  };
}

export function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "unknown";
}
