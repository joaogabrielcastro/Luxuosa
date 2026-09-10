import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const variation = {
  id: "v1",
  tenantId: "t1",
  stock: 5,
  product: { name: "Camisa", category: { name: "Cat" }, brand: { name: "Lux" } }
};

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      stockMovement: {
        findMany: async () => [{ id: "m1", type: "ENTRY", quantity: 2 }]
      },
      async $transaction(fn) {
        const tx = {
          productVariation: {
            findFirst: async ({ where }) => (where.id === "v1" ? { ...variation } : null),
            update: async ({ data }) => {
              if (data.stock?.decrement) variation.stock -= data.stock.decrement;
              if (data.stock?.increment) variation.stock += data.stock.increment;
              return variation;
            }
          },
          stockMovement: {
            create: async ({ data }) => ({
              id: "m-new",
              ...data,
              productVariation: { product: variation.product }
            })
          }
        };
        return fn(tx);
      }
    }
  }
});

const { stockMovementService } = await import("./stockMovement.service.js");

describe("stockMovementService", () => {
  it("lista e movimenta entrada/saida", async () => {
    const listed = await stockMovementService.list("t1", { take: "10", skip: "-1" });
    assert.equal(listed[0].id, "m1");
    await assert.rejects(() => stockMovementService.create("t1", { type: "ENTRY", quantity: 0 }), /inteiro/);
    await assert.rejects(
      () => stockMovementService.create("t1", { productVariationId: "x", type: "ENTRY", quantity: 1 }),
      /nao encontrada/
    );
    const entry = await stockMovementService.create("t1", {
      productVariationId: "v1",
      type: "ENTRY",
      quantity: 2
    });
    assert.equal(entry.type, "ENTRY");
    await assert.rejects(
      () => stockMovementService.create("t1", { productVariationId: "v1", type: "EXIT", quantity: 99 }),
      /insuficiente/
    );
    const exit = await stockMovementService.create("t1", {
      productVariationId: "v1",
      type: "EXIT",
      quantity: 1
    });
    assert.equal(exit.type, "EXIT");
  });
});
