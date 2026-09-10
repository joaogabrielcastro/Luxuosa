import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAndValidateSaleLineItems } from "./saleStockLineItems.js";

describe("buildAndValidateSaleLineItems", () => {
  const variationMap = new Map([
    ["v1", { id: "v1", stock: 5 }],
    ["v2", { id: "v2", stock: 1 }]
  ]);

  it("monta linhas", () => {
    const rows = buildAndValidateSaleLineItems(
      [
        { productVariationId: "v1", quantity: 2, unitPrice: 10 },
        { productVariationId: "v2", quantity: 1, unitPrice: 5 }
      ],
      variationMap
    );
    assert.equal(rows.length, 2);
  });

  it("rejeita repeticao e estoque", () => {
    assert.throws(
      () =>
        buildAndValidateSaleLineItems(
          [
            { productVariationId: "v1", quantity: 1, unitPrice: 1 },
            { productVariationId: "v1", quantity: 1, unitPrice: 1 }
          ],
          variationMap
        ),
      /repetir/
    );
    assert.throws(
      () => buildAndValidateSaleLineItems([{ productVariationId: "v9", quantity: 1, unitPrice: 1 }], variationMap),
      /invalida/
    );
    assert.throws(
      () => buildAndValidateSaleLineItems([{ productVariationId: "v2", quantity: 9, unitPrice: 1 }], variationMap),
      /insuficiente/
    );
  });
});
