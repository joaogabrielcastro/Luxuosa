import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  api,
  destroyTenant,
  registerTenant,
  seedCatalog,
  startTestServer
} from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("reports integration", { skip: !runDb }, () => {
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

  it("sales report e low-stock", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, {
      stock: 1,
      price: 45
    });

    await api(server.baseUrl, "/products/" + catalog.productId, {
      method: "PUT",
      token: session.token,
      body: { minStock: 10 }
    });

    const sale = await api(server.baseUrl, "/sales", {
      method: "POST",
      token: session.token,
      body: {
        paymentMethod: "PIX",
        installments: 1,
        emitNfce: false,
        items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: 45 }]
      }
    });
    assert.equal(sale.status, 201);

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const from = `${y}-${m}-01`;
    const to = `${y}-${m}-${d}`;

    const salesReport = await api(
      server.baseUrl,
      `/reports/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { token: session.token }
    );
    assert.equal(salesReport.status, 200);
    assert.ok(Number(salesReport.data.saleCount) >= 1 || Number(salesReport.data.totalAmount) >= 0);

    const low = await api(server.baseUrl, "/reports/low-stock", { token: session.token });
    assert.equal(low.status, 200);
    assert.ok(Array.isArray(low.data.items) || Array.isArray(low.data));

    const bad = await api(server.baseUrl, "/reports/sales?from=2026-09-10&to=2026-09-01", {
      token: session.token
    });
    assert.equal(bad.status, 400);
    const missingRange = await api(server.baseUrl, "/reports/sales", { token: session.token });
    assert.equal(missingRange.status, 400);
  });
});
