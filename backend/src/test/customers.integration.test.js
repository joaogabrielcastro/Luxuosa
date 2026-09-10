import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { api, destroyTenant, registerTenant, startTestServer } from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("customers integration", { skip: !runDb }, () => {
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

  it("CRUD clientes", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const { token } = session;

    const created = await api(server.baseUrl, "/customers", {
      method: "POST",
      token,
      body: {
        name: "Maria Silva",
        cpfCnpj: "12345678901",
        phone: "11999999999",
        email: `maria.${Date.now()}@luxuosa.test`,
        address: "Rua A, 10",
        uf: "SP",
        cep: "01310100"
      }
    });
    assert.equal(created.status, 201);
    const id = created.data.id;

    const list = await api(server.baseUrl, "/customers", { token });
    assert.equal(list.status, 200);
    const items = list.data.items || list.data;
    assert.ok(items.some((c) => c.id === id));

    const get = await api(server.baseUrl, `/customers/${id}`, { token });
    assert.equal(get.status, 200);
    assert.equal(get.data.name, "Maria Silva");

    const updated = await api(server.baseUrl, `/customers/${id}`, {
      method: "PUT",
      token,
      body: { name: "Maria Souza", phone: "11988887777" }
    });
    assert.equal(updated.status, 204);

    const afterUp = await api(server.baseUrl, `/customers/${id}`, { token });
    assert.equal(afterUp.data.name, "Maria Souza");

    const removed = await api(server.baseUrl, `/customers/${id}`, {
      method: "DELETE",
      token
    });
    assert.equal(removed.status, 204);

    const missing = await api(server.baseUrl, `/customers/${id}`, { token });
    assert.equal(missing.status, 404);

    const search = await api(server.baseUrl, "/customers?q=Maria", { token });
    assert.equal(search.status, 200);
    const updMissing = await api(server.baseUrl, "/customers/cxxxxxxxxxxxxxxxxxxxxxxx", {
      method: "PUT",
      token,
      body: { name: "X" }
    });
    assert.ok([400, 404].includes(updMissing.status));
    const delMissing = await api(server.baseUrl, "/customers/cxxxxxxxxxxxxxxxxxxxxxxx", {
      method: "DELETE",
      token
    });
    assert.ok([400, 404].includes(delMissing.status));
  });
});
