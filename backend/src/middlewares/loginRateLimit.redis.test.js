import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { env } from "../config/env.js";

class FakeRedis {
  constructor() {
    this.status = "wait";
    this.counts = new Map();
  }
  on() {
    return this;
  }
  async connect() {
    this.status = "ready";
  }
  async incr(key) {
    const n = (this.counts.get(key) || 0) + 1;
    this.counts.set(key, n);
    return n;
  }
  async pexpire() {
    return 1;
  }
}

mock.module("ioredis", {
  defaultExport: FakeRedis
});

const { loginRateLimit } = await import("./loginRateLimit.js");

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

describe("loginRateLimit Redis", () => {
  it("usa Redis quando REDIS_URL existe", async () => {
    const prevUrl = env.redisUrl;
    const prevMax = env.loginRateLimitMax;
    env.redisUrl = "redis://localhost:6379";
    env.loginRateLimitMax = 2;
    const req = { headers: {}, ip: "9.9.9.9" };
    let nexts = 0;
    await loginRateLimit(req, mockRes(), () => {
      nexts += 1;
    });
    await loginRateLimit(req, mockRes(), () => {
      nexts += 1;
    });
    const res = mockRes();
    await loginRateLimit(req, res, () => {});
    assert.equal(nexts, 2);
    assert.equal(res.statusCode, 429);
    env.redisUrl = prevUrl;
    env.loginRateLimitMax = prevMax;
  });
});
