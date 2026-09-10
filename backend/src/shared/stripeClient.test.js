import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getStripe, isStripeConfigured } from "./stripeClient.js";
import { env } from "../config/env.js";

describe("stripeClient", () => {
  it("nao configurado lanca 503", () => {
    const prev = env.stripe.secretKey;
    env.stripe.secretKey = "";
    assert.equal(isStripeConfigured(), false);
    try {
      getStripe();
      assert.fail("deveria lancar");
    } catch (err) {
      assert.equal(err.statusCode, 503);
      assert.equal(err.code, "STRIPE_NOT_CONFIGURED");
    }
    env.stripe.secretKey = prev;
  });
});
