import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const usersByEmail = new Map();
let tenantByCnpj = null;
let createdTenant = { id: "t1", name: "Loja", cnpj: "12345678000199", plan: "BASIC", enableNfceEmission: false };
let createdUser = { id: "u1", tenantId: "t1", name: "Admin", email: "a@loja.test", type: "ADMIN", password: "hash" };
let txUserExists = false;
let txError = null;
let meTenant = { ...createdTenant, notaasApiKey: "ntaas_abc" };
let meUser = { id: "u1", name: "Admin", email: "a@loja.test", type: "ADMIN", tenantId: "t1" };

mock.module("./auth.repository.js", {
  namedExports: {
    authRepository: {
      findUsersWithTenantByEmail: async (email) => usersByEmail.get(email) || []
    }
  }
});

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      tenant: {
        findUnique: async ({ where }) => {
          if (where.cnpj) return tenantByCnpj;
          if (where.id === "t1") return meTenant;
          return null;
        }
      },
      user: {
        findUnique: async ({ where }) => (where.id === meUser?.id ? meUser : null)
      },
      async $transaction(fn) {
        if (txError) throw txError;
        const tx = {
          tenant: {
            create: async ({ data }) => ({ ...createdTenant, ...data })
          },
          user: {
            findFirst: async () => (txUserExists ? { id: "dup" } : null),
            create: async ({ data }) => ({ ...createdUser, ...data })
          }
        };
        return fn(tx);
      }
    }
  }
});

const { authService } = await import("./auth.service.js");

describe("authService", () => {
  it("login invalido, CNPJ obrigatorio e senha", async () => {
    await assert.rejects(() => authService.login("x@loja.test", "senha123"), /Credenciais invalidas/);
    usersByEmail.set("dup@loja.test", [
      { id: "u1", password: await hash("senha123"), tenant: { cnpj: "12345678000199" }, tenantId: "t1", name: "A", email: "dup@loja.test", type: "ADMIN" },
      { id: "u2", password: await hash("senha123"), tenant: { cnpj: "11111111000111" }, tenantId: "t2", name: "B", email: "dup@loja.test", type: "ADMIN" }
    ]);
    await assert.rejects(() => authService.login("dup@loja.test", "senha123"), /Informe o CNPJ/);
    await assert.rejects(
      () => authService.login("dup@loja.test", "senha123", "000"),
      /Informe o CNPJ/
    );
    await assert.rejects(
      () => authService.login("dup@loja.test", "senha123", "99999999000199"),
      /Credenciais invalidas/
    );
    await assert.rejects(
      () => authService.login("dup@loja.test", "errada12", "12345678000199"),
      /Credenciais invalidas/
    );
    const ok = await authService.login("dup@loja.test", "senha123", "12345678000199");
    assert.ok(ok.token);
  });

  it("register CNPJ, duplicata e P2002", async () => {
    await assert.rejects(
      () =>
        authService.register({
          tenantName: "L",
          cnpj: "123",
          tenantEmail: "l@loja.test",
          adminName: "A",
          adminEmail: "a@loja.test",
          adminPassword: "senha123"
        }),
      /14 digitos/
    );
    tenantByCnpj = { id: "exists" };
    await assert.rejects(
      () =>
        authService.register({
          tenantName: "L",
          cnpj: "12345678000199",
          tenantEmail: "l@loja.test",
          adminName: "A",
          adminEmail: "a@loja.test",
          adminPassword: "senha123"
        }),
      /Ja existe uma loja/
    );
    tenantByCnpj = null;
    txUserExists = true;
    await assert.rejects(
      () =>
        authService.register({
          tenantName: "L",
          cnpj: "12345678000199",
          tenantEmail: "l@loja.test",
          adminName: "A",
          adminEmail: "a@loja.test",
          adminPassword: "senha123"
        }),
      /administrador com este e-mail/
    );
    txUserExists = false;
    const registered = await authService.register({
      tenantName: "Loja Nova",
      cnpj: "12.345.678/0001-99",
      tenantEmail: "l@loja.test",
      tenantPhone: "1199999",
      adminName: "Admin",
      adminEmail: "a@loja.test",
      adminPassword: "senha123"
    });
    assert.ok(registered.token);

    txError = { code: "P2002", meta: { target: ["cnpj"] } };
    await assert.rejects(
      () =>
        authService.register({
          tenantName: "L",
          cnpj: "12345678000199",
          tenantEmail: "l@loja.test",
          adminName: "A",
          adminEmail: "a@loja.test",
          adminPassword: "senha123"
        }),
      /CNPJ/
    );
    txError = { code: "P2002", meta: { target: "email" } };
    await assert.rejects(
      () =>
        authService.register({
          tenantName: "L",
          cnpj: "12345678000199",
          tenantEmail: "l@loja.test",
          adminName: "A",
          adminEmail: "a@loja.test",
          adminPassword: "senha123"
        }),
      /e-mail/
    );
    txError = { code: "P2002", meta: { target: "other" } };
    await assert.rejects(
      () =>
        authService.register({
          tenantName: "L",
          cnpj: "12345678000199",
          tenantEmail: "l@loja.test",
          adminName: "A",
          adminEmail: "a@loja.test",
          adminPassword: "senha123"
        }),
      /Dados ja cadastrados/
    );
    txError = new Error("db");
    await assert.rejects(
      () =>
        authService.register({
          tenantName: "L",
          cnpj: "12345678000199",
          tenantEmail: "l@loja.test",
          adminName: "A",
          adminEmail: "a@loja.test",
          adminPassword: "senha123"
        }),
      /db/
    );
    txError = null;
  });

  it("me sessao invalida", async () => {
    const ok = await authService.me("t1", "u1");
    assert.equal(ok.user.id, "u1");
    meTenant = null;
    await assert.rejects(() => authService.me("t1", "u1"), /Sessao invalida/);
    meTenant = { id: "t1", name: "Loja", cnpj: "12345678000199", plan: "BASIC", enableNfceEmission: false };
    meUser = { id: "u1", name: "Admin", email: "a@loja.test", type: "ADMIN", tenantId: "other" };
    await assert.rejects(() => authService.me("t1", "u1"), /Sessao invalida/);
    meUser = { id: "u1", name: "Admin", email: "a@loja.test", type: "ADMIN", tenantId: "t1" };
    await assert.rejects(() => authService.listStores("missing", "t1"), /Sessao invalida/);
  });

  it("lista e troca lojas no Enterprise", async () => {
    meUser = { id: "u1", name: "Admin", email: "dup@loja.test", type: "ADMIN", tenantId: "t1" };
    meTenant = { id: "t1", name: "Loja", cnpj: "12345678000199", plan: "ENTERPRISE", enableNfceEmission: false };
    usersByEmail.set("dup@loja.test", [
      {
        id: "u1",
        password: "x",
        tenantId: "t1",
        name: "A",
        email: "dup@loja.test",
        type: "ADMIN",
        tenant: { id: "t1", name: "Loja A", cnpj: "12345678000199", plan: "ENTERPRISE", enableNfceEmission: false }
      },
      {
        id: "u2",
        password: "x",
        tenantId: "t2",
        name: "B",
        email: "dup@loja.test",
        type: "ADMIN",
        tenant: { id: "t2", name: "Loja B", cnpj: "11111111000111", plan: "PRO", enableNfceEmission: false }
      }
    ]);
    const listed = await authService.listStores("u1", "t1");
    assert.equal(listed.canSwitch, true);
    assert.equal(listed.stores.length, 2);
    await assert.rejects(() => authService.switchStore("u1", "t1", "t1"), /outra loja/);
    await assert.rejects(() => authService.switchStore("u1", "t1", "missing"), /Sem acesso/);
    const switched = await authService.switchStore("u1", "t1", "t2");
    assert.equal(switched.tenant.id, "t2");
    assert.ok(switched.token);
  });

  it("bloqueia troca de loja sem Enterprise", async () => {
    meUser = { id: "u1", name: "Admin", email: "solo@loja.test", type: "ADMIN", tenantId: "t1" };
    usersByEmail.set("solo@loja.test", [
      {
        id: "u1",
        tenantId: "t1",
        name: "A",
        email: "solo@loja.test",
        type: "ADMIN",
        tenant: { id: "t1", name: "Loja", cnpj: "12345678000199", plan: "PRO", enableNfceEmission: false }
      }
    ]);
    const listed = await authService.listStores("u1", "t1");
    assert.equal(listed.canSwitch, false);
    await assert.rejects(() => authService.switchStore("u1", "t1", "t2"), /ENTERPRISE/);
  });
});

async function hash(password) {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.hash(password, 4);
}
