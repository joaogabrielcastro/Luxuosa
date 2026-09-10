import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

let tenantPlan = { plan: "PRO", planGateExempt: false };

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      tenant: {
        findUnique: async () => tenantPlan
      },
      user: {
        findMany: async () => [{ id: "u1", name: "Admin" }]
      },
      sale: {
        findMany: async () => [
          { totalValue: 40, occurredAt: new Date("2026-09-01T12:00:00"), paymentMethod: "PIX", userId: "u1" },
          { totalValue: 10, occurredAt: new Date("2026-09-01T18:00:00"), paymentMethod: "CASH", userId: "u1" }
        ],
        aggregate: async () => ({ _sum: { totalValue: 50 }, _count: { _all: 2 } })
      }
    }
  }
});

mock.module("../dashboard/dashboard.queries.js", {
  namedExports: {
    profitByProductInRange: async () => [
      { productId: "p1", name: "Camisa", revenue: 50, cost: 20, profit: 30 }
    ],
    productsWithoutSalesInRange: async () => [{ productId: "p2", name: "Saia" }]
  }
});

mock.module("../products/product.service.js", {
  namedExports: {
    productService: {
      lowStock: async () => [{ id: "p1", name: "Camisa" }]
    }
  }
});

const { reportsService } = await import("./reports.service.js");

describe("reportsService", () => {
  it("valida intervalo e agrega vendas", async () => {
    tenantPlan = { plan: "PRO", planGateExempt: false };
    await assert.rejects(() => reportsService.salesByPeriod("t1"), /from e to/);
    await assert.rejects(() => reportsService.salesByPeriod("t1", "nope", "2026-09-01"), /invalidas/);
    await assert.rejects(() => reportsService.salesByPeriod("t1", "2026-09-10", "2026-09-01"), /inicial/);
    const data = await reportsService.salesByPeriod("t1", "2026-09-01", "2026-09-10");
    assert.equal(data.saleCount, 2);
    assert.equal(data.totalAmount, 50);
    assert.equal(data.ticketAverage, 25);
    assert.equal(data.byDay[0].count, 2);
    assert.equal(data.byPayment.length, 2);
    assert.equal(data.byAttendant[0].name, "Admin");
    assert.equal(data.advanced, null);
    const low = await reportsService.lowStock("t1");
    assert.equal(low.count, 1);
  });

  it("inclui bloco avancado no Enterprise", async () => {
    tenantPlan = { plan: "ENTERPRISE", planGateExempt: false };
    const data = await reportsService.salesByPeriod("t1", "2026-09-01", "2026-09-10");
    assert.equal(data.advanced.profitByProduct[0].name, "Camisa");
    assert.equal(data.advanced.productsWithoutSales[0].name, "Saia");
    assert.ok(data.advanced.previous.from);
  });
});
