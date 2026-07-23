import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FEATURE_MIN_PLAN,
  normalizeStripePlan,
  planAtLeast,
  PLAN_CATALOG,
  PLAN_RANK,
  tenantMeetsPlan
} from "./planCatalog.js";

describe("planAtLeast", () => {
  it("BASIC < PRO < ENTERPRISE", () => {
    assert.equal(planAtLeast("BASIC", "BASIC"), true);
    assert.equal(planAtLeast("BASIC", "PRO"), false);
    assert.equal(planAtLeast("PRO", "BASIC"), true);
    assert.equal(planAtLeast("PRO", "PRO"), true);
    assert.equal(planAtLeast("PRO", "ENTERPRISE"), false);
    assert.equal(planAtLeast("ENTERPRISE", "PRO"), true);
    assert.equal(planAtLeast("ENTERPRISE", "ENTERPRISE"), true);
  });

  it("plano desconhecido trata como BASIC", () => {
    assert.equal(planAtLeast(null, "BASIC"), true);
    assert.equal(planAtLeast("FOO", "PRO"), false);
  });

  it("FEATURE_MIN_PLAN alinha ranks", () => {
    assert.equal(PLAN_RANK[FEATURE_MIN_PLAN.nfeImport], PLAN_RANK.PRO);
    assert.equal(PLAN_RANK[FEATURE_MIN_PLAN.nfceEmission], PLAN_RANK.PRO);
    assert.equal(PLAN_RANK[FEATURE_MIN_PLAN.stockAlerts], PLAN_RANK.PRO);
  });
});

describe("tenantMeetsPlan", () => {
  it("respeita plano quando nao isento", () => {
    assert.equal(tenantMeetsPlan({ plan: "BASIC", planGateExempt: false }, "PRO"), false);
    assert.equal(tenantMeetsPlan({ plan: "PRO", planGateExempt: false }, "PRO"), true);
  });

  it("legado (planGateExempt) libera qualquer feature", () => {
    assert.equal(tenantMeetsPlan({ plan: "BASIC", planGateExempt: true }, "PRO"), true);
    assert.equal(tenantMeetsPlan({ plan: "BASIC", planGateExempt: true }, "ENTERPRISE"), true);
  });
});

describe("PLAN_CATALOG precos", () => {
  it("PRO R$ 97 e ENTERPRISE R$ 250", () => {
    assert.equal(PLAN_CATALOG.PRO.amountCents, 9700);
    assert.equal(PLAN_CATALOG.PRO.priceLabel, "R$ 97/mes");
    assert.equal(PLAN_CATALOG.ENTERPRISE.amountCents, 25000);
    assert.equal(PLAN_CATALOG.ENTERPRISE.priceLabel, "R$ 250/mes");
    assert.equal(PLAN_CATALOG.BASIC.amountCents, 0);
  });
});

describe("normalizeStripePlan", () => {
  it("normaliza ids validos", () => {
    assert.equal(normalizeStripePlan("pro"), "PRO");
    assert.equal(normalizeStripePlan("ENTERPRISE"), "ENTERPRISE");
    assert.equal(normalizeStripePlan("BASIC"), "BASIC");
  });

  it("retorna null para invalido", () => {
    assert.equal(normalizeStripePlan(""), null);
    assert.equal(normalizeStripePlan("GOLD"), null);
    assert.equal(normalizeStripePlan(undefined), null);
  });
});
