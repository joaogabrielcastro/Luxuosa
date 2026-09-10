import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const tenant = {
  stockAlertsEnabled: true,
  stockAlertEmail: "alerta@loja.test",
  stockAlertPhone: "11999999999",
  stockAlertMinSeverity: "low",
  stockAlertCooldownMin: 0
};

const logs = [];
let fetchImpl = async () => ({ ok: true, text: async () => "" });

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      tenant: {
        findUnique: async ({ where }) => (where.id === "missing" ? null : tenant),
        update: async ({ data }) => {
          Object.assign(tenant, data);
          return { ...tenant };
        }
      },
      stockAlertLog: {
        findMany: async () => logs,
        count: async () => logs.length,
        findFirst: async () => logs[0] || null,
        create: async ({ data }) => {
          const row = { id: `log-${logs.length}`, createdAt: new Date(), ...data };
          logs.push(row);
          return row;
        }
      }
    }
  }
});

mock.module("../products/product.service.js", {
  namedExports: {
    productService: {
      lowStock: async () => [
        { id: "p1", name: "Camisa", currentStock: 0, minStock: 2, severity: "critical" }
      ]
    }
  }
});

const originalFetch = global.fetch;
global.fetch = (...args) => fetchImpl(...args);

const { stockAlertService } = await import("./stockAlert.service.js");

describe("stockAlertService", () => {
  it("settings 404 e validacao", async () => {
    await assert.rejects(() => stockAlertService.getSettings("missing"), /nao encontrada/);
    await assert.rejects(() => stockAlertService.updateSettings("t1", { minSeverity: "high" }), /low ou critical/);
    await assert.rejects(() => stockAlertService.updateSettings("t1", { cooldownMin: -1 }), /invalido/);
    const updated = await stockAlertService.updateSettings("t1", {
      enabled: true,
      email: "  novo@loja.test  ",
      phone: " 11988887777 ",
      minSeverity: "critical",
      cooldownMin: 10
    });
    assert.equal(updated.minSeverity, "critical");
    assert.equal(updated.email, "novo@loja.test");
  });

  it("run desabilitado, logs e canais", async () => {
    tenant.stockAlertsEnabled = false;
    const skipped = await stockAlertService.runCheck("t1");
    assert.equal(skipped.ran, false);

    tenant.stockAlertsEnabled = true;
    tenant.stockAlertMinSeverity = "low";
    tenant.stockAlertCooldownMin = 0;
    tenant.stockAlertEmail = "alerta@loja.test";
    tenant.stockAlertPhone = "11999999999";
    logs.length = 0;

    const ran = await stockAlertService.runCheck("t1");
    assert.equal(ran.ran, true);
    assert.equal(ran.alerts[0].email, "logged");
    assert.equal(ran.alerts[0].whatsapp, "skipped");

    const listed = await stockAlertService.listLogs("t1", { take: 10, skip: 0 });
    assert.ok(listed.total >= 1);

    logs.push({
      id: "old",
      productId: "p1",
      status: "logged",
      createdAt: new Date()
    });
    tenant.stockAlertCooldownMin = 1440;
    const cool = await stockAlertService.runCheck("t1");
    assert.equal(cool.alerts[0].reason, "cooldown");
  });

  it("whatsapp webhook erro e fetch throw", async () => {
    tenant.stockAlertCooldownMin = 0;
    logs.length = 0;
    const { env } = await import("../../config/env.js");
    const prev = env.whatsappWebhookUrl;
    env.whatsappWebhookUrl = "https://wa.test/hook";

    fetchImpl = async () => ({ ok: false, status: 500, text: async () => "fail" });
    const errored = await stockAlertService.runCheck("t1");
    assert.equal(errored.alerts[0].whatsapp, "error");

    fetchImpl = async () => {
      throw new Error("network");
    };
    logs.length = 0;
    const thrown = await stockAlertService.runCheck("t1");
    assert.equal(thrown.alerts[0].whatsapp, "error");

    env.whatsappWebhookUrl = prev;
    global.fetch = originalFetch;
  });
});
