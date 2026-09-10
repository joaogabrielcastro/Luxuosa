import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      sale: {
        findMany: async () => [{ id: "s1" }],
        count: async () => 1,
        findFirst: async () => ({ id: "s1", items: [] }),
        create: async ({ data }) => ({ id: "s-new", ...data }),
        update: async ({ data }) => ({ id: "s1", ...data })
      }
    }
  }
});

const { saleRepository } = await import("./sale.repository.js");

describe("saleRepository", () => {
  it("lista com filtros e busca por id", async () => {
    const listed = await saleRepository.list("t1", {
      paymentMethod: "PIX",
      nfce: "ISSUED",
      q: "chave",
      summary: true
    });
    assert.equal(listed.total, 1);
    const waiting = await saleRepository.list("t1", { nfce: "WAITING" });
    assert.equal(waiting.total, 1);
    const full = await saleRepository.list("t1", {});
    assert.equal(full.items[0].id, "s1");
    assert.equal((await saleRepository.findByIdPlain("t1", "s1")).id, "s1");
    assert.equal((await saleRepository.findForNfe("t1", "s1")).id, "s1");

    const tx = {
      sale: {
        create: async ({ data }) => ({ id: "s-tx", ...data, items: data.items.create }),
        findFirst: async () => ({ id: "s1", items: [] }),
        update: async ({ data }) => ({ id: "s1", ...data })
      }
    };
    const created = await saleRepository.createWithItems(
      tx,
      "t1",
      { totalValue: 10 },
      [{ productVariationId: "v1", quantity: 1, unitPrice: 10 }]
    );
    assert.equal(created.id, "s-tx");
    assert.equal((await saleRepository.findById(tx, "t1", "s1")).id, "s1");
    const updated = await saleRepository.updateWithItems(tx, "t1", "s1", { totalValue: 20 }, [
      { productVariationId: "v1", quantity: 2, unitPrice: 10 }
    ]);
    assert.equal(updated.id, "s1");
  });
});
