import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const users = new Map();
let tenantPlan = { plan: "PRO", planGateExempt: false };

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      tenant: {
        findUnique: async () => tenantPlan
      }
    }
  }
});

mock.module("./user.repository.js", {
  namedExports: {
    userPublicSelect: { id: true },
    userRepository: {
      listByTenant: async (tenantId) => [...users.values()].filter((u) => u.tenantId === tenantId),
      findPublicById: async (tenantId, id) => users.get(id) || null,
      findUniqueById: async (tenantId, id) => users.get(id) || null,
      findByEmail: async (tenantId, email) => [...users.values()].find((u) => u.email === email) || null,
      countByTenant: async (tenantId) => [...users.values()].filter((u) => u.tenantId === tenantId).length,
      countAdmins: async (tenantId, exclude) =>
        [...users.values()].filter((u) => u.type === "ADMIN" && u.id !== exclude).length,
      create: async (tenantId, data) => {
        const row = { id: "u-new", tenantId, ...data };
        users.set(row.id, row);
        return row;
      },
      update: async (tenantId, id, data) => {
        const row = users.get(id);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      delete: async (tenantId, id) => {
        if (!users.has(id)) return { count: 0 };
        users.delete(id);
        return { count: 1 };
      }
    }
  }
});

const { userService } = await import("./user.service.js");

describe("userService", () => {
  it("cria, bloqueia e-mail duplicado e atualiza", async () => {
    users.clear();
    users.set("admin", { id: "admin", tenantId: "t1", email: "a@loja.com", type: "ADMIN", name: "A" });
    const created = await userService.create("t1", {
      name: "Ana",
      email: "ana@loja.com",
      password: "secret1",
      type: "ATTENDANT"
    });
    assert.equal(created.email, "ana@loja.com");
    await assert.rejects(
      () => userService.create("t1", { name: "X", email: "ana@loja.com", password: "secret1", type: "ATTENDANT" }),
      /e-mail/
    );
    const updated = await userService.update("t1", created.id, { name: "Ana Silva", password: "secret2" });
    assert.equal(updated.name, "Ana Silva");
  });

  it("nao rebaixa nem exclui ultimo admin", async () => {
    users.clear();
    users.set("admin", { id: "admin", tenantId: "t1", email: "a@loja.com", type: "ADMIN", name: "A" });
    await assert.rejects(() => userService.update("t1", "admin", { type: "ATTENDANT" }), /ultimo administrador/);
    await assert.rejects(() => userService.remove("t1", "admin", "other"), /ultimo administrador/);
    await assert.rejects(() => userService.remove("t1", "admin", "admin"), /proprio usuario/);
    await assert.rejects(() => userService.update("t1", "missing", { name: "X" }), /nao encontrado/);
    assert.equal(await userService.getById("t1", "admin"), users.get("admin"));
    assert.equal((await userService.list("t1")).length, 1);
  });

  it("respeita limite de usuarios do plano", async () => {
    users.clear();
    tenantPlan = { plan: "BASIC", planGateExempt: false };
    users.set("u1", { id: "u1", tenantId: "t1", email: "a@loja.com", type: "ADMIN", name: "A" });
    users.set("u2", { id: "u2", tenantId: "t1", email: "b@loja.com", type: "ATTENDANT", name: "B" });
    users.set("u3", { id: "u3", tenantId: "t1", email: "c@loja.com", type: "ATTENDANT", name: "C" });
    await assert.rejects(
      () => userService.create("t1", { name: "D", email: "d@loja.com", password: "secret1", type: "ATTENDANT" }),
      /Limite de 3 usuarios/
    );
    tenantPlan = { plan: "BASIC", planGateExempt: true };
    const extra = await userService.create("t1", {
      name: "D",
      email: "d@loja.com",
      password: "secret1",
      type: "ATTENDANT"
    });
    assert.equal(extra.email, "d@loja.com");
    tenantPlan = null;
    await assert.rejects(
      () => userService.create("t1", { name: "E", email: "e@loja.com", password: "secret1", type: "ATTENDANT" }),
      /Loja nao encontrada/
    );
    tenantPlan = { plan: "PRO", planGateExempt: false };
  });

  it("update/remove 404 quando repositorio nao altera", async () => {
    users.clear();
    users.set("att", { id: "att", tenantId: "t1", email: "b@loja.com", type: "ATTENDANT", name: "A" });
    const origUpdate = (await import("./user.repository.js")).userRepository.update;
    const repo = (await import("./user.repository.js")).userRepository;
    repo.update = async () => ({ count: 0 });
    await assert.rejects(() => userService.update("t1", "att", { name: "X" }), /nao encontrado/);
    repo.update = origUpdate;
    repo.delete = async () => ({ count: 0 });
    await assert.rejects(() => userService.remove("t1", "att", "admin"), /nao encontrado/);
    await assert.rejects(() => userService.remove("t1", "missing", "admin"), /nao encontrado/);
  });
});
