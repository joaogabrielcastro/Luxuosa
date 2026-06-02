import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "../../config/prisma.js";
import {
  productsWithoutSalesAggregated,
  profitByProductAggregated,
  salesByPeriodAggregated,
  stockConsolidatedAggregated
} from "./dashboard.queries.js";

const runDbTests = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("dashboard.queries (integracao)", { skip: !runDbTests }, () => {
  it("agregacoes retornam arrays para um tenant existente", async () => {
    const tenant = await prisma.tenant.findFirst({ select: { id: true } });
    assert.ok(tenant, "seed necessario: nenhum tenant no banco");

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const noSalesSince = new Date();
    noSalesSince.setDate(noSalesSince.getDate() - 30);

    const [byPeriod, profit, stock, inactive] = await Promise.all([
      salesByPeriodAggregated(tenant.id, monthStart),
      profitByProductAggregated(tenant.id),
      stockConsolidatedAggregated(tenant.id),
      productsWithoutSalesAggregated(tenant.id, noSalesSince)
    ]);

    assert.ok(Array.isArray(byPeriod));
    assert.ok(Array.isArray(profit));
    assert.ok(Array.isArray(stock));
    assert.ok(Array.isArray(inactive));

    for (const row of stock) {
      assert.ok(row.productId);
      assert.ok(typeof row.stock === "number");
    }
  });
});
