import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  api,
  destroyTenant,
  prisma,
  registerTenant,
  seedCatalog,
  startTestServer
} from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("stock integration", { skip: !runDb }, () => {
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

  it("EXIT reduz estoque; EXIT acima da quantidade falha", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 5 });

    const exitOk = await api(server.baseUrl, "/stock-movements", {
      method: "POST",
      token: session.token,
      body: {
        productVariationId: catalog.variationId,
        type: "EXIT",
        quantity: 2
      }
    });
    assert.equal(exitOk.status, 201);

    const afterExit = await prisma.productVariation.findFirst({
      where: { id: catalog.variationId, tenantId: session.tenantId }
    });
    assert.equal(afterExit.stock, 3);

    const oversell = await api(server.baseUrl, "/stock-movements", {
      method: "POST",
      token: session.token,
      body: {
        productVariationId: catalog.variationId,
        type: "EXIT",
        quantity: 10
      }
    });
    assert.equal(oversell.status, 400);

    const unchanged = await prisma.productVariation.findFirst({
      where: { id: catalog.variationId, tenantId: session.tenantId }
    });
    assert.equal(unchanged.stock, 3);

    const listed = await api(server.baseUrl, "/stock-movements", { token: session.token });
    assert.equal(listed.status, 200);
    assert.ok(Array.isArray(listed.data) || Array.isArray(listed.data?.items));

    const entry = await api(server.baseUrl, "/stock-movements", {
      method: "POST",
      token: session.token,
      body: { productVariationId: catalog.variationId, type: "ENTRY", quantity: 1 }
    });
    assert.equal(entry.status, 201);

    const missing = await api(server.baseUrl, "/stock-movements", {
      method: "POST",
      token: session.token,
      body: { productVariationId: "clxxxxxxxxxxxxxxxxxxxx", type: "ENTRY", quantity: 1 }
    });
    assert.equal(missing.status, 404);
  });
});
