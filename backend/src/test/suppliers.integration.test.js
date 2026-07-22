import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { api, destroyTenant, registerTenant, startTestServer, uniqueTestCnpj } from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("suppliers integration", { skip: !runDb }, () => {
  /** @type {{ baseUrl: string, close: () => Promise<void> }} */
  let server;
  const tenantIds = [];

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    for (const id of tenantIds) {
      await destroyTenant(id);
    }
    await server.close();
  });

  it("create list update supplier", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const { token } = session;
    const cnpj = uniqueTestCnpj();

    const created = await api(server.baseUrl, "/suppliers", {
      method: "POST",
      token,
      body: {
        name: "Fornecedor Teste LTDA",
        tradeName: "Forn Teste",
        cnpj,
        stateRegistration: "123456789"
      }
    });
    assert.equal(created.status, 201);
    const id = created.data.id;

    const list = await api(server.baseUrl, "/suppliers", { token });
    assert.equal(list.status, 200);
    assert.ok(list.data.some((s) => s.id === id));

    const updated = await api(server.baseUrl, `/suppliers/${id}`, {
      method: "PUT",
      token,
      body: { tradeName: "Forn Atualizado" }
    });
    assert.equal(updated.status, 204);

    const get = await api(server.baseUrl, `/suppliers/${id}`, { token });
    assert.equal(get.status, 200);
    assert.equal(get.data.tradeName, "Forn Atualizado");
  });
});
