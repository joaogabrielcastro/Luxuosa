import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PaymentMethod } from "@prisma/client";
import {
  assertNoDuplicateVariationLines,
  normalizePaymentMethod
} from "./salePayload.js";

describe("normalizePaymentMethod", () => {
  it("aceita enum Prisma", () => {
    assert.equal(normalizePaymentMethod(PaymentMethod.PIX), PaymentMethod.PIX);
  });

  it("mapeia alias em portugues", () => {
    assert.equal(normalizePaymentMethod("dinheiro"), PaymentMethod.CASH);
    assert.equal(normalizePaymentMethod("cartao_credito"), PaymentMethod.CREDIT_CARD);
    assert.equal(normalizePaymentMethod("parcelamento"), PaymentMethod.INSTALLMENT);
  });

  it("rejeita valor invalido", () => {
    assert.throws(() => normalizePaymentMethod("bitcoin"), (err) => err.statusCode === 400);
  });
});

describe("assertNoDuplicateVariationLines", () => {
  it("permite variacoes distintas", () => {
    assert.doesNotThrow(() =>
      assertNoDuplicateVariationLines([
        { productVariationId: "a" },
        { productVariationId: "b" }
      ])
    );
  });

  it("bloqueia variacao repetida", () => {
    assert.throws(
      () =>
        assertNoDuplicateVariationLines([
          { productVariationId: "a" },
          { productVariationId: "a" }
        ]),
      (err) => err.statusCode === 400
    );
  });
});
