import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const products = new Map([["p1", { id: "p1", tenantId: "t1" }]]);
const variations = new Map([
  ["v1", { id: "v1", tenantId: "t1", size: "M", color: "Azul", productId: "p1" }]
]);
let saleCount = 0;
let creditCount = 0;
let updateCount = 1;

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      product: {
        findFirst: async ({ where }) =>
          where.id === "p1" && where.tenantId === "t1" ? products.get("p1") : null
      },
      productVariation: {
        findFirst: async ({ where }) => variations.get(where.id) || null
      },
      async $transaction(fn) {
        const tx = {
          productVariation: {
            findFirst: async ({ where }) => variations.get(where.id) || null,
            deleteMany: async () => ({ count: 1 })
          },
          saleItem: { count: async () => saleCount },
          creditSaleItem: { count: async () => creditCount },
          stockMovement: { deleteMany: async () => ({ count: 1 }) }
        };
        return fn(tx);
      }
    }
  }
});

mock.module("./productVariation.repository.js", {
  namedExports: {
    productVariationRepository: {
      list: async () => [...variations.values()],
      listPaged: async () => ({ items: [...variations.values()], total: 1, take: 50, skip: 0 }),
      findById: async (_t, id) => variations.get(id) || null,
      create: async (tenantId, payload) => ({ id: "v-new", tenantId, ...payload }),
      update: async () => ({ count: updateCount })
    }
  }
});

const { productVariationService } = await import("./productVariation.service.js");

describe("productVariationService", () => {
  it("lista e rejeita tamanho/cor inconsistentes", async () => {
    assert.equal((await productVariationService.list("t1"))[0].id, "v1");
    assert.equal((await productVariationService.listPaged("t1", {})).total, 1);
    assert.equal((await productVariationService.getById("t1", "v1")).id, "v1");
    await assert.rejects(
      () => productVariationService.create("t1", { productId: "p1", size: "M", color: "" }),
      /Tamanho e Cor/
    );
  });

  it("cria variacao padrao e rejeita produto de outro tenant", async () => {
    const created = await productVariationService.create("t1", {
      productId: "p1",
      size: "",
      color: "",
      stock: 3
    });
    assert.equal(created.id, "v-new");
    await assert.rejects(
      () => productVariationService.create("t1", { productId: "missing", size: "P", color: "Preto" }),
      /Produto invalido/
    );
  });

  it("update 404, coerencia e produto invalido", async () => {
    await assert.rejects(() => productVariationService.update("t1", "missing", { stock: 1 }), /nao encontrada/);
    await assert.rejects(
      () => productVariationService.update("t1", "v1", { size: "G", color: "" }),
      /Tamanho e Cor/
    );
    await assert.rejects(
      () => productVariationService.update("t1", "v1", { productId: "x" }),
      /Produto invalido/
    );
    const ok = await productVariationService.update("t1", "v1", { stock: 9, productId: "p1" });
    assert.equal(ok.count, 1);
    updateCount = 0;
    await assert.rejects(() => productVariationService.update("t1", "v1", { stock: 1 }), /nao encontrada/);
    updateCount = 1;
  });

  it("remove bloqueia venda vinculada e 404", async () => {
    saleCount = 1;
    await assert.rejects(() => productVariationService.remove("t1", "v1"), /crediario vinculados/);
    saleCount = 0;
    creditCount = 1;
    await assert.rejects(() => productVariationService.remove("t1", "v1"), /crediario vinculados/);
    creditCount = 0;
    await assert.rejects(() => productVariationService.remove("t1", "missing"), /nao encontrada/);
    const removed = await productVariationService.remove("t1", "v1");
    assert.equal(removed.count, 1);
  });
});
