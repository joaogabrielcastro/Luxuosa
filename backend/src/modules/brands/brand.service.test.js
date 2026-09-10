import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const store = new Map([["b1", { id: "b1", name: "Lux" }]]);

mock.module("./brand.repository.js", {
  namedExports: {
    brandRepository: {
      findMany: async () => [...store.values()],
      findUniqueById: async (_t, id) => store.get(id) || null,
      create: async (_t, payload) => ({ id: "b-new", ...payload }),
      update: async (_t, id) => ({ count: store.has(id) ? 1 : 0 }),
      delete: async (_t, id) => ({ count: store.has(id) ? 1 : 0 })
    }
  }
});

const { brandService } = await import("./brand.service.js");

describe("brandService", () => {
  it("CRUD e 404", async () => {
    assert.equal((await brandService.list("t1"))[0].id, "b1");
    assert.equal((await brandService.getById("t1", "b1")).name, "Lux");
    assert.equal((await brandService.create("t1", { name: "Nova" })).id, "b-new");
    assert.equal((await brandService.update("t1", "b1", { name: "Lux 2" })).count, 1);
    await assert.rejects(() => brandService.update("t1", "x", { name: "X" }), /nao encontrada/);
    await assert.rejects(() => brandService.remove("t1", "x"), /nao encontrada/);
    assert.equal((await brandService.remove("t1", "b1")).count, 1);
  });
});
