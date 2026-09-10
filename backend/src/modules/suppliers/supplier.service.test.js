import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const rows = new Map();

mock.module("./supplier.repository.js", {
  namedExports: {
    supplierRepository: {
      list: async () => [...rows.values()],
      findById: async (_t, id) => rows.get(id) || null,
      findByCnpj: async (_t, cnpj) => [...rows.values()].find((r) => r.cnpj === cnpj) || null,
      create: async (tenantId, data) => {
        const row = { id: "s1", tenantId, ...data };
        rows.set(row.id, row);
        return row;
      },
      update: async (_t, id, data) => {
        const row = rows.get(id);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }
    }
  }
});

const { supplierService } = await import("./supplier.service.js");

describe("supplierService", () => {
  it("valida CNPJ, duplicata e update", async () => {
    await assert.rejects(() => supplierService.create("t1", { name: "A", cnpj: "123" }), /14 digitos/);
    const created = await supplierService.create("t1", {
      name: "  Forn  ",
      cnpj: "12.345.678/0001-99",
      tradeName: "  Fantasia  ",
      stateRegistration: " IE "
    });
    assert.equal(created.cnpj, "12345678000199");
    await assert.rejects(
      () => supplierService.create("t1", { name: "Outro", cnpj: "12345678000199" }),
      /Ja existe/
    );
    assert.equal((await supplierService.list("t1")).length, 1);
    assert.equal((await supplierService.getById("t1", "s1")).id, "s1");

    await assert.rejects(() => supplierService.update("t1", "s1", { cnpj: "1" }), /14 digitos/);
    rows.set("s2", { id: "s2", cnpj: "11111111000111" });
    await assert.rejects(
      () => supplierService.update("t1", "s1", { cnpj: "11111111000111" }),
      /Ja existe/
    );
    const updated = await supplierService.update("t1", "s1", {
      name: "Forn Ltda",
      tradeName: null,
      stateRegistration: "  ",
      cnpj: "12345678000199"
    });
    assert.equal(updated.count, 1);
    await assert.rejects(() => supplierService.update("t1", "missing", { name: "X" }), /nao encontrado/);
  });
});
