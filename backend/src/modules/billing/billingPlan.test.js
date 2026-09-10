import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planFromSubscription, subscriptionPeriodEnd } from "./billingPlan.js";

describe("subscriptionPeriodEnd", () => {
  it("converte unix timestamp", () => {
    const end = subscriptionPeriodEnd({ current_period_end: 1_700_000_000 });
    assert.equal(end instanceof Date, true);
    assert.equal(end.getTime(), 1_700_000_000 * 1000);
  });

  it("retorna null sem periodo", () => {
    assert.equal(subscriptionPeriodEnd(null), null);
    assert.equal(subscriptionPeriodEnd({}), null);
  });
});

describe("planFromSubscription", () => {
  it("usa metadata.plan", () => {
    assert.equal(planFromSubscription({ metadata: { plan: "ENTERPRISE" } }), "ENTERPRISE");
  });

  it("usa lookup_key do preco", () => {
    assert.equal(
      planFromSubscription({
        items: { data: [{ price: { lookup_key: "luxuosa_pro_monthly" } }] }
      }),
      "PRO"
    );
  });

  it("fallback PRO quando nao da para mapear", () => {
    assert.equal(planFromSubscription({}), "PRO");
  });
});
