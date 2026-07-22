import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  api,
  destroyTenant,
  registerTenant,
  startTestServer,
  uniqueEmail
} from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("dashboard integration", { skip: !runDb }, () => {
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

  it("GET /dashboard/admin como admin", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    const res = await api(server.baseUrl, "/dashboard/admin?compact=1", {
      token: session.token
    });
    assert.equal(res.status, 200);
    assert.ok(res.data);
  });

  it("GET /dashboard/admin como atendente retorna 403", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    const attendantEmail = uniqueEmail("att-dash");
    const created = await api(server.baseUrl, "/users", {
      method: "POST",
      token: session.token,
      body: {
        name: "Atendente Dash",
        email: attendantEmail,
        password: "senha123",
        type: "ATTENDANT"
      }
    });
    assert.equal(created.status, 201);

    const login = await api(server.baseUrl, "/auth/login", {
      method: "POST",
      body: { email: attendantEmail, password: "senha123" }
    });
    assert.equal(login.status, 200);

    const forbidden = await api(server.baseUrl, "/dashboard/admin", {
      token: login.data.token
    });
    assert.equal(forbidden.status, 403);
  });
});
