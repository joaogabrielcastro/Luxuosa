import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const customers = [
  { id: "c1", name: "Maria", cpfCnpj: "12345678901", email: "maria@loja.test" }
];

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      customer: {
        findMany: async ({ where }) => {
          if (where.OR) return customers;
          return customers;
        },
        count: async () => customers.length
      }
    }
  }
});

mock.module("./customer.repository.js", {
  namedExports: {
    customerRepository: {
      findUniqueById: async (_t, id) => customers.find((c) => c.id === id) || null,
      create: async (_t, payload) => ({ id: "c-new", ...payload }),
      update: async (_t, id) => ({ count: id === "c1" ? 1 : 0 }),
      delete: async (_t, id) => ({ count: id === "c1" ? 1 : 0 })
    }
  }
});

const { customerService } = await import("./customer.service.js");

describe("customerService", () => {
  it("lista com busca, CRUD e 404", async () => {
    const paged = await customerService.listPaged("t1", { q: "Maria" });
    assert.equal(paged.total, 1);
    assert.equal((await customerService.list("t1")).total, 1);
    assert.equal((await customerService.getById("t1", "c1")).name, "Maria");
    assert.equal((await customerService.create("t1", { name: "Ana" })).id, "c-new");
    assert.equal((await customerService.update("t1", "c1", { name: "Maria S" })).count, 1);
    await assert.rejects(() => customerService.update("t1", "x", { name: "X" }), /nao encontrado/);
    await assert.rejects(() => customerService.remove("t1", "x"), /nao encontrado/);
    assert.equal((await customerService.remove("t1", "c1")).count, 1);
  });
});
