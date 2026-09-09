import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "../../config/prisma.js";
import { destroyTenant, uniqueTestCnpj } from "../../test/helpers.js";
import {
  crediarioOpenAggregated,
  productsWithoutSalesAggregated,
  profitByProductAggregated,
  salesByPeriodAggregated,
  stockConsolidatedAggregated
} from "./dashboard.queries.js";

const runDbTests = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("dashboard.queries (integracao)", { skip: !runDbTests }, () => {
  /** @type {string | null} */
  let tenantId = null;

  before(async () => {
    const cnpj = uniqueTestCnpj();
    const tenant = await prisma.tenant.create({
      data: {
        name: `Dashboard Query ${cnpj.slice(-4)}`,
        cnpj,
        email: `dash.${cnpj}@luxuosa.test`,
        plan: "BASIC"
      }
    });
    tenantId = tenant.id;
  });

  after(async () => {
    if (tenantId) await destroyTenant(tenantId);
  });

  it("agregacoes retornam arrays para um tenant existente", async () => {
    assert.ok(tenantId);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const noSalesSince = new Date();
    noSalesSince.setDate(noSalesSince.getDate() - 30);

    const [byPeriod, profit, stock, inactive, open] = await Promise.all([
      salesByPeriodAggregated(tenantId, monthStart),
      profitByProductAggregated(tenantId),
      stockConsolidatedAggregated(tenantId),
      productsWithoutSalesAggregated(tenantId, noSalesSince),
      crediarioOpenAggregated(tenantId)
    ]);

    assert.ok(Array.isArray(byPeriod));
    assert.ok(Array.isArray(profit));
    assert.ok(Array.isArray(stock));
    assert.ok(Array.isArray(inactive));
    assert.equal(open.remaining, 0);
    assert.equal(open.count, 0);

    for (const row of stock) {
      assert.ok(row.productId);
      assert.ok(typeof row.stock === "number");
    }
  });
});
