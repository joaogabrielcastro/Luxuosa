import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertTenantScope, BaseTenantRepository } from "./baseTenantRepository.js";

describe("assertTenantScope", () => {
  it("injeta tenantId no where", () => {
    const scoped = assertTenantScope({ id: "prod-1" }, "tenant-a");
    assert.deepEqual(scoped, { id: "prod-1", tenantId: "tenant-a" });
  });

  it("preserva filtros e sobrescreve tenantId coerente", () => {
    const scoped = assertTenantScope({ tenantId: "tenant-a", status: "PAID" }, "tenant-a");
    assert.equal(scoped.tenantId, "tenant-a");
    assert.equal(scoped.status, "PAID");
  });

  it("rejeita tenantId ausente", () => {
    assert.throws(() => assertTenantScope({}, ""), (err) => err.statusCode === 500);
    assert.throws(() => assertTenantScope({}, null), (err) => err.statusCode === 500);
  });

  it("rejeita where com outro tenantId (cross-tenant)", () => {
    assert.throws(
      () => assertTenantScope({ tenantId: "tenant-b", id: "x" }, "tenant-a"),
      (err) => err.statusCode === 403
    );
  });
});

describe("BaseTenantRepository", () => {
  it("findMany sempre envia tenantId no where", async () => {
    /** @type {{ where?: object }} */
    let lastArgs = {};
    const fakeModel = {
      findMany(args) {
        lastArgs = args;
        return Promise.resolve([]);
      }
    };
    const repo = new BaseTenantRepository(fakeModel);
    await repo.findMany("tenant-a", { name: "X" });
    assert.equal(lastArgs.where.tenantId, "tenant-a");
    assert.equal(lastArgs.where.name, "X");
  });

  it("findUniqueById nao permite leitura cross-tenant via where", async () => {
    /** @type {{ where?: object }} */
    let lastArgs = {};
    const fakeModel = {
      findFirst(args) {
        lastArgs = args;
        return Promise.resolve(null);
      }
    };
    const repo = new BaseTenantRepository(fakeModel);
    await repo.findUniqueById("tenant-a", "sale-1");
    assert.deepEqual(lastArgs.where, { id: "sale-1", tenantId: "tenant-a" });
  });
});
