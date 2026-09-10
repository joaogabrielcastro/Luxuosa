import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authMiddleware, requireAdmin } from "./authMiddleware.js";
import { tenantMiddleware } from "./tenantMiddleware.js";
import { errorHandler } from "./errorHandler.js";
import { loginRateLimit } from "./loginRateLimit.js";
import { env } from "../config/env.js";

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

describe("authMiddleware", () => {
  it("401 sem token", () => {
    let err;
    authMiddleware({ headers: {} }, {}, (e) => {
      err = e;
    });
    assert.equal(err.statusCode, 401);
  });

  it("401 token invalido", () => {
    let err;
    authMiddleware({ headers: { authorization: "Bearer lixo" } }, {}, (e) => {
      err = e;
    });
    assert.equal(err.statusCode, 401);
    assert.equal(err.code, "TOKEN_INVALID");
  });

  it("aceita JWT e requireAdmin", () => {
    const token = jwt.sign({ tenant_id: "t1", user_type: "ADMIN" }, env.jwtSecret, { subject: "u1" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    authMiddleware(req, {}, () => {});
    assert.equal(req.user.tenantId, "t1");
    let next = false;
    requireAdmin(req, {}, () => {
      next = true;
    });
    assert.equal(next, true);
    let forbid;
    requireAdmin({ user: { type: "ATTENDANT" } }, {}, (e) => {
      forbid = e;
    });
    assert.equal(forbid.statusCode, 403);
  });
});

describe("tenantMiddleware", () => {
  it("403 sem tenant", () => {
    let err;
    tenantMiddleware({ user: {} }, {}, (e) => {
      err = e;
    });
    assert.equal(err.statusCode, 403);
  });

  it("preenche tenantId", () => {
    const req = { user: { tenantId: "t1" } };
    tenantMiddleware(req, {}, () => {});
    assert.equal(req.tenantId, "t1");
  });
});

describe("errorHandler", () => {
  it("zod 400", () => {
    const res = mockRes();
    const err = z.object({ name: z.string().min(2) }).safeParse({ name: "" }).error;
    errorHandler(err, { path: "/x", method: "POST" }, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "VALIDATION_ERROR");
  });

  it("prisma known e validation", () => {
    const res = mockRes();
    const prismaErr = new Prisma.PrismaClientKnownRequestError("dup", {
      code: "P2002",
      clientVersion: "6.0.0",
      meta: { target: ["sku"] }
    });
    errorHandler(prismaErr, { path: "/x", method: "POST" }, res, () => {});
    assert.equal(res.statusCode, 409);

    const res2 = mockRes();
    const val = new Prisma.PrismaClientValidationError("bad", { clientVersion: "6.0.0" });
    errorHandler(val, { path: "/x", method: "POST" }, res2, () => {});
    assert.equal(res2.statusCode, 400);
  });

  it("operacional e 500", () => {
    const res = mockRes();
    const err = new Error("nao achou");
    err.statusCode = 404;
    errorHandler(err, { path: "/x", method: "GET" }, res, () => {});
    assert.equal(res.statusCode, 404);

    const res2 = mockRes();
    errorHandler(new Error("boom"), { path: "/x", method: "GET", tenantId: "t" }, res2, () => {});
    assert.equal(res2.statusCode, 500);
    assert.equal(res2.body.code, "INTERNAL_ERROR");
  });
});

describe("loginRateLimit", () => {
  it("permite e depois 429", async () => {
    const prev = env.loginRateLimitMax;
    env.loginRateLimitMax = 2;
    const req = { headers: { "x-forwarded-for": "10.1.2.3" }, ip: "10.1.2.3" };
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
    env.loginRateLimitMax = prev;
  });
});
