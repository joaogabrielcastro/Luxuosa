import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

let tenantRow = { plan: "BASIC", planGateExempt: false };

mock.module("../config/prisma.js", {
  namedExports: {
    prisma: {
      tenant: {
        findUnique: async () => tenantRow
      }
    }
  }
});

const { requirePlan } = await import("./requirePlan.js");

function run(minPlan, req) {
  return new Promise((resolve) => {
    const mw = requirePlan(minPlan);
    mw(req, {}, (err) => resolve(err));
  });
}

describe("requirePlan", () => {
  it("401 sem tenant", async () => {
    const err = await run("PRO", { user: {} });
    assert.equal(err.statusCode, 401);
  });

  it("404 loja inexistente", async () => {
    tenantRow = null;
    const err = await run("PRO", { tenantId: "t1" });
    assert.equal(err.statusCode, 404);
    tenantRow = { plan: "BASIC", planGateExempt: false };
  });

  it("402 plano insuficiente", async () => {
    tenantRow = { plan: "BASIC", planGateExempt: false };
    const err = await run("PRO", { tenantId: "t1" });
    assert.equal(err.statusCode, 402);
    assert.equal(err.code, "PLAN_UPGRADE_REQUIRED");
  });

  it("libera PRO e isento", async () => {
    tenantRow = { plan: "PRO", planGateExempt: false };
    const req = { tenantId: "t1" };
    const err = await run("PRO", req);
    assert.equal(err, undefined);
    assert.equal(req.tenantPlan, "PRO");

    tenantRow = { plan: "BASIC", planGateExempt: true };
    const req2 = { tenantId: "t1" };
    const err2 = await run("ENTERPRISE", req2);
    assert.equal(err2, undefined);
  });
});
