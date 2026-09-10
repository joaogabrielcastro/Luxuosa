import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const calls = [];

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      productVariation: {
        findMany: async (args) => {
          calls.push(["findMany", args]);
          return [{ id: "v1" }];
        },
        count: async () => {
          calls.push(["count"]);
          return 1;
        },
        findFirst: async () => ({ id: "v1" }),
        create: async (args) => ({ id: "v2", ...args.data }),
        updateMany: async () => ({ count: 1 }),
        deleteMany: async () => ({ count: 1 })
      }
    }
  }
});

const { productVariationRepository } = await import("./productVariation.repository.js");

describe("productVariationRepository", () => {
  it("lista, filtra e altera", async () => {
    const all = await productVariationRepository.list("t1");
    assert.equal(all[0].id, "v1");
    const paged = await productVariationRepository.listPaged("t1", {
      take: 10,
      skip: 0,
      q: "cam",
      categoryId: "cat1",
      brandId: "br1",
      productId: "p1"
    });
    assert.equal(paged.total, 1);
    assert.equal((await productVariationRepository.findById("t1", "v1")).id, "v1");
    assert.equal((await productVariationRepository.create("t1", { size: "M" })).id, "v2");
    assert.equal((await productVariationRepository.update("t1", "v1", { stock: 2 })).count, 1);
    assert.equal((await productVariationRepository.remove("t1", "v1")).count, 1);
    const filtered = calls.find((c) => c[0] === "findMany" && c[1]?.where?.product);
    assert.ok(filtered);
  });
});
