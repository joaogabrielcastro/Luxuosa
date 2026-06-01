import { env } from "../config/env.js";

const buckets = new Map();

function clientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip;
  return ip || "unknown";
}

/** Limite simples por IP no login (sem dependencia extra). */
export function loginRateLimit(req, res, next) {
  const key = clientKey(req);
  const now = Date.now();
  const windowMs = env.loginRateLimitWindowMs;
  const max = env.loginRateLimitMax;

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > max) {
    return res.status(429).json({
      error: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
      code: "LOGIN_RATE_LIMIT"
    });
  }
  return next();
}
