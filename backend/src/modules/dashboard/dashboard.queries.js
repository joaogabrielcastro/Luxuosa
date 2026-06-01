import { prisma } from "../../config/prisma.js";

function num(row, key) {
  return Number(row[key] ?? 0);
}

/** Vendas pagas por dia no mês corrente. */
export async function salesByPeriodAggregated(tenantId, monthStart) {
  const rows = await prisma.$queryRaw`
    SELECT
      to_char(date_trunc('day', s."occurredAt"), 'YYYY-MM-DD') AS date,
      COALESCE(SUM(s."totalValue"), 0)::float AS amount,
      COUNT(*)::int AS count
    FROM "Sale" s
    WHERE s."tenantId" = ${tenantId}
      AND s.status = 'PAID'::"SaleStatus"
      AND s."occurredAt" >= ${monthStart}
    GROUP BY date_trunc('day', s."occurredAt")
    ORDER BY date_trunc('day', s."occurredAt")
  `;
  return rows.map((r) => ({
    date: r.date,
    amount: num(r, "amount"),
    count: Number(r.count)
  }));
}

/** Lucro por produto (vendas pagas). */
export async function profitByProductAggregated(tenantId) {
  const rows = await prisma.$queryRaw`
    SELECT
      p.id AS "productId",
      p.name,
      COALESCE(SUM(si.quantity * si."unitPrice"), 0)::float AS revenue,
      COALESCE(SUM(si.quantity * p.cost), 0)::float AS cost,
      COALESCE(SUM(si.quantity * (si."unitPrice" - p.cost)), 0)::float AS profit
    FROM "SaleItem" si
    INNER JOIN "Sale" s ON s.id = si."saleId"
    INNER JOIN "ProductVariation" pv ON pv.id = si."productVariationId"
    INNER JOIN "Product" p ON p.id = pv."productId"
    WHERE si."tenantId" = ${tenantId}
      AND s.status = 'PAID'::"SaleStatus"
    GROUP BY p.id, p.name
    ORDER BY profit DESC
  `;
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    revenue: num(r, "revenue"),
    cost: num(r, "cost"),
    profit: num(r, "profit")
  }));
}

/** Estoque total por produto. */
export async function stockConsolidatedAggregated(tenantId) {
  const rows = await prisma.$queryRaw`
    SELECT
      p.id AS "productId",
      p.name,
      COALESCE(SUM(pv.stock), 0)::int AS stock
    FROM "Product" p
    LEFT JOIN "ProductVariation" pv
      ON pv."productId" = p.id AND pv."tenantId" = p."tenantId"
    WHERE p."tenantId" = ${tenantId}
    GROUP BY p.id, p.name
    ORDER BY p.name
  `;
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    stock: Number(r.stock)
  }));
}

/** Produtos sem venda paga nos últimos N dias. */
export async function productsWithoutSalesAggregated(tenantId, noSalesSince) {
  const rows = await prisma.$queryRaw`
    SELECT
      p.id AS "productId",
      p.name,
      MAX(s."occurredAt") AS "lastSaleAt"
    FROM "Product" p
    LEFT JOIN "ProductVariation" pv
      ON pv."productId" = p.id AND pv."tenantId" = p."tenantId"
    LEFT JOIN "SaleItem" si ON si."productVariationId" = pv.id AND si."tenantId" = p."tenantId"
    LEFT JOIN "Sale" s
      ON s.id = si."saleId"
      AND s.status = 'PAID'::"SaleStatus"
    WHERE p."tenantId" = ${tenantId}
    GROUP BY p.id, p.name
    HAVING MAX(s."occurredAt") IS NULL OR MAX(s."occurredAt") < ${noSalesSince}
    ORDER BY p.name
  `;
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    lastSaleAt: r.lastSaleAt ?? null
  }));
}
