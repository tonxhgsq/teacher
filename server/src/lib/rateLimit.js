const buckets = new Map();

function clientKey(req) {
  return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

function cleanup(now) {
  if (buckets.size < 5000) return;
  for (const [key, item] of buckets.entries()) {
    if (item.resetAt <= now) buckets.delete(key);
  }
}

export function createRateLimit({
  windowMs,
  max,
  keyPrefix,
  message = '请求过于频繁，请稍后再试',
  key = clientKey,
}) {
  const disabled = String(process.env.RATE_LIMIT_DISABLED || '').toLowerCase() === 'true';
  return (req, res, next) => {
    if (disabled || req.method === 'OPTIONS') return next();
    const now = Date.now();
    cleanup(now);
    const bucketKey = `${keyPrefix}:${key(req)}`;
    const current = buckets.get(bucketKey);
    const item = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + windowMs };
    item.count += 1;
    buckets.set(bucketKey, item);
    const remaining = Math.max(0, max - item.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(item.resetAt / 1000)));
    if (item.count > max) {
      const retryAfter = Math.max(1, Math.ceil((item.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message, retryAfter });
    }
    next();
  };
}
