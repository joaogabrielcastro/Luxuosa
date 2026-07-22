import Redis from "ioredis";
import { env } from "../config/env.js";

const buckets = new Map();

/** @type {import("ioredis").Redis | null} */
let redis = null;
let redisFailed = false;

function getRedis() {
  if (redisFailed || !env.redisUrl) return null;
  if (redis) return redis;
  try {
    redis = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true
    });
    redis.on("error", () => {
      /* fallback Map on errors */
    });
    return redis;
  } catch {
    redisFailed = true;
    return null;
  }
}

function clientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip;
  return ip || "unknown";
}

async function checkWithMap(key, windowMs, max) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count > max;
}

async function checkWithRedis(key, windowMs, max) {
  const client = getRedis();
  if (!client) return checkWithMap(key, windowMs, max);

  try {
    if (client.status !== "ready") {
      await client.connect().catch(() => null);
    }
    const redisKey = `login_rl:${key}`;
    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.pexpire(redisKey, windowMs);
    }
    return count > max;
  } catch {
    return checkWithMap(key, windowMs, max);
  }
}

/** Limite por IP no login — Redis se REDIS_URL estiver definido, senao Map em memoria. */
export async function loginRateLimit(req, res, next) {
  try {
    const key = clientKey(req);
    const windowMs = env.loginRateLimitWindowMs;
    const max = env.loginRateLimitMax;
    const limited = await checkWithRedis(key, windowMs, max);
    if (limited) {
      return res.status(429).json({
        error: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
        code: "LOGIN_RATE_LIMIT"
      });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
