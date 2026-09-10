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

describe("stock alerts integration", { skip: !runDb }, () => {
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

  it("run com SMTP ausente marca canal email como logged", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: {
        plan: "PRO",
        stockAlertsEnabled: true,
        stockAlertEmail: "alerta@luxuosa.test",
        stockAlertMinSeverity: "low",
        stockAlertCooldownMin: 0
      }
    });

    // Produto com estoque abaixo do minimo (seed usa stock; minStock tipico > 0).
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 0, price: 20 });
    await prisma.product.update({
      where: { id: catalog.productId },
      data: { minStock: 2 }
    });

    const settings = await api(server.baseUrl, "/stock-alerts/settings", {
      token: session.token
    });
    assert.equal(settings.status, 200);
    assert.equal(settings.data.enabled, true);

    const run = await api(server.baseUrl, "/stock-alerts/run", {
      method: "POST",
      token: session.token
    });
    assert.equal(run.status, 200);
    assert.equal(run.data.ran, true);
    assert.ok(run.data.alerts?.length >= 1);

    const logs = await api(server.baseUrl, "/stock-alerts/logs", { token: session.token });
    assert.equal(logs.status, 200);
    const items = logs.data.items || [];
    const emailLog = items.find((row) => row.channel === "email" && row.productId === catalog.productId);
    assert.ok(emailLog);
    assert.equal(emailLog.status, "logged");

    const updated = await api(server.baseUrl, "/stock-alerts/settings", {
      method: "PUT",
      token: session.token,
      body: { enabled: false, email: "", phone: "11999999999", minSeverity: "critical", cooldownMin: 60 }
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.enabled, false);

    const disabledRun = await api(server.baseUrl, "/stock-alerts/run", {
      method: "POST",
      token: session.token
    });
    assert.equal(disabledRun.status, 200);
    assert.equal(disabledRun.data.ran, false);
  });
});
