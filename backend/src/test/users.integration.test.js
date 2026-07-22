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

describe("users integration", { skip: !runDb }, () => {
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

  it("update user, delete attendant, cannot delete self / last admin", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const { token } = session;

    const attendantEmail = uniqueEmail("att-users");
    const attendant = await api(server.baseUrl, "/users", {
      method: "POST",
      token,
      body: {
        name: "Atendente Users",
        email: attendantEmail,
        password: "senha123",
        type: "ATTENDANT"
      }
    });
    assert.equal(attendant.status, 201);
    const attendantId = attendant.data.id;

    const updated = await api(server.baseUrl, `/users/${attendantId}`, {
      method: "PUT",
      token,
      body: { name: "Atendente Renomeado" }
    });
    assert.equal(updated.status, 204);

    const selfDelete = await api(server.baseUrl, `/users/${session.userId}`, {
      method: "DELETE",
      token
    });
    assert.equal(selfDelete.status, 409);

    const deleted = await api(server.baseUrl, `/users/${attendantId}`, {
      method: "DELETE",
      token
    });
    assert.equal(deleted.status, 204);

    const list = await api(server.baseUrl, "/users", { token });
    assert.equal(list.status, 200);
    assert.ok(!list.data.some((u) => u.id === attendantId));
    assert.equal(list.data.filter((u) => u.type === "ADMIN").length, 1);
  });
});
