function splitList(value = '') {
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

export function corsOptions() {
  const allowed = splitList(process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS);
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      if (!isProduction && allowed.length === 0) return callback(null, true);
      return callback(null, false);
    },
  };
}
