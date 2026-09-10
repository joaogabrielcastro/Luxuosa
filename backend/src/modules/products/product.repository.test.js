import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const products = [{ id: "p1", name: "Camisa", sku: "CAM" }];

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      product: {
        findMany: async () => products,
        count: async () => products.length,
        findFirst: async ({ where }) => products.find((p) => p.id === where.id) || null,
        create: async ({ data }) => ({ id: "p-new", ...data }),
        updateMany: async () => ({ count: 1 })
      }
    }
  }
});

const { productRepository } = await import("./product.repository.js");

describe("productRepository", () => {
  it("lista, filtra e altera", async () => {
    assert.equal((await productRepository.list("t1"))[0].id, "p1");
    const paged = await productRepository.listPaged("t1", {
      q: "Cam",
      categoryId: "c1",
      brandId: "b1",
      take: 10,
      skip: 0
    });
    assert.equal(paged.total, 1);
    assert.equal((await productRepository.findById("t1", "p1")).id, "p1");
    assert.equal((await productRepository.create("t1", { name: "X" })).id, "p-new");
    assert.equal((await productRepository.update("t1", "p1", { name: "Y" })).count, 1);
    assert.equal((await productRepository.findLowStock("t1")).length, 1);
  });
});
