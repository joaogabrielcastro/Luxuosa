import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const store = new Map([["c1", { id: "c1", name: "Vestidos" }]]);

mock.module("./category.repository.js", {
  namedExports: {
    categoryRepository: {
      findMany: async () => [...store.values()],
      findUniqueById: async (_t, id) => store.get(id) || null,
      create: async (_t, payload) => ({ id: "c-new", ...payload }),
      update: async (_t, id) => ({ count: store.has(id) ? 1 : 0 }),
      delete: async (_t, id) => ({ count: store.has(id) ? 1 : 0 })
    }
  }
});

const { categoryService } = await import("./category.service.js");

describe("categoryService", () => {
  it("CRUD e 404", async () => {
    assert.equal((await categoryService.list("t1"))[0].id, "c1");
    assert.equal((await categoryService.getById("t1", "c1")).name, "Vestidos");
    assert.equal((await categoryService.create("t1", { name: "Saias" })).id, "c-new");
    assert.equal((await categoryService.update("t1", "c1", { name: "Vestidos 2" })).count, 1);
    await assert.rejects(() => categoryService.update("t1", "x", { name: "X" }), /nao encontrada/);
    await assert.rejects(() => categoryService.remove("t1", "x"), /nao encontrada/);
    assert.equal((await categoryService.remove("t1", "c1")).count, 1);
  });
});
