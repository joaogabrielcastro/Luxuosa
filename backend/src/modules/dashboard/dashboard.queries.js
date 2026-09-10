import { prisma } from "../../config/prisma.js";

function num(row, key) {
  return Number(row[key] ?? 0);
}

/** Saldo em aberto de crediário (contas OPEN). */
export async function crediarioOpenAggregated(tenantId) {
  const rows = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(GREATEST(cs."totalValue" - cs."paidTotal", 0)), 0)::float AS remaining,
      COUNT(*)::int AS count
    FROM "CreditSale" cs
    WHERE cs."tenantId" = ${tenantId}
      AND cs.status = 'OPEN'::"CreditSaleStatus"
  `;
  const row = rows[0] || {};
  return {
    remaining: num(row, "remaining"),
    count: Number(row.count || 0)
  };
}

/** Vendas pagas e recebimentos de crediário por dia no mês corrente. */
export async function salesByPeriodAggregated(tenantId, monthStart) {
  const rows = await prisma.$queryRaw`
    SELECT
      date,
      COALESCE(SUM(amount), 0)::float AS amount,
      SUM(count)::int AS count
    FROM (
      SELECT
        to_char(date_trunc('day', s."occurredAt"), 'YYYY-MM-DD') AS date,
        COALESCE(SUM(s."totalValue"), 0)::float AS amount,
        COUNT(*)::int AS count
      FROM "Sale" s
      WHERE s."tenantId" = ${tenantId}
        AND s.status = 'PAID'::"SaleStatus"
        AND s."occurredAt" >= ${monthStart}
      GROUP BY date_trunc('day', s."occurredAt")

      UNION ALL

      SELECT
        to_char(date_trunc('day', cp."paidAt"), 'YYYY-MM-DD') AS date,
        COALESCE(SUM(cp.amount), 0)::float AS amount,
        COUNT(*)::int AS count
      FROM "CreditPayment" cp
      WHERE cp."tenantId" = ${tenantId}
        AND cp."paidAt" >= ${monthStart}
      GROUP BY date_trunc('day', cp."paidAt")
    ) combined
    GROUP BY date
    ORDER BY date
  `;
  return rows.map((r) => ({
    date: r.date,
    amount: num(r, "amount"),
    count: Number(r.count)
  }));
}

/** Lucro por produto (vendas à vista pagas + crediário quitado). */
export async function profitByProductAggregated(tenantId) {
  const rows = await prisma.$queryRaw`
    SELECT
      "productId",
      name,
      COALESCE(SUM(revenue), 0)::float AS revenue,
      COALESCE(SUM(cost), 0)::float AS cost,
      COALESCE(SUM(profit), 0)::float AS profit
    FROM (
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

      UNION ALL

      SELECT
        p.id AS "productId",
        p.name,
        COALESCE(SUM(csi.quantity * csi."unitPrice"), 0)::float AS revenue,
        COALESCE(SUM(csi.quantity * p.cost), 0)::float AS cost,
        COALESCE(SUM(csi.quantity * (csi."unitPrice" - p.cost)), 0)::float AS profit
      FROM "CreditSaleItem" csi
      INNER JOIN "CreditSale" cs ON cs.id = csi."creditSaleId"
      INNER JOIN "ProductVariation" pv ON pv.id = csi."productVariationId"
      INNER JOIN "Product" p ON p.id = pv."productId"
      WHERE csi."tenantId" = ${tenantId}
        AND cs.status = 'PAID'::"CreditSaleStatus"
      GROUP BY p.id, p.name
    ) combined
    GROUP BY "productId", name
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

/** Produtos sem venda paga ou crediário (não cancelado) nos últimos N dias. */
export async function productsWithoutSalesAggregated(tenantId, noSalesSince) {
  const rows = await prisma.$queryRaw`
    SELECT
      p.id AS "productId",
      p.name,
      MAX(events.at) AS "lastSaleAt"
    FROM "Product" p
    LEFT JOIN "ProductVariation" pv
      ON pv."productId" = p.id AND pv."tenantId" = p."tenantId"
    LEFT JOIN (
      SELECT si."productVariationId" AS vid, si."tenantId", s."occurredAt" AS at
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s.id = si."saleId" AND s.status = 'PAID'::"SaleStatus"

      UNION ALL

      SELECT csi."productVariationId" AS vid, csi."tenantId", cs."occurredAt" AS at
      FROM "CreditSaleItem" csi
      INNER JOIN "CreditSale" cs
        ON cs.id = csi."creditSaleId"
        AND cs.status <> 'CANCELED'::"CreditSaleStatus"
    ) events ON events.vid = pv.id AND events."tenantId" = p."tenantId"
    WHERE p."tenantId" = ${tenantId}
    GROUP BY p.id, p.name
    HAVING MAX(events.at) IS NULL OR MAX(events.at) < ${noSalesSince}
    ORDER BY p.name
  `;
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    lastSaleAt: r.lastSaleAt ?? null
  }));
}

/** Lucro por produto no intervalo (vendas à vista pagas + crediário quitado). */
export async function profitByProductInRange(tenantId, start, end) {
  const rows = await prisma.$queryRaw`
    SELECT
      "productId",
      name,
      COALESCE(SUM(revenue), 0)::float AS revenue,
      COALESCE(SUM(cost), 0)::float AS cost,
      COALESCE(SUM(profit), 0)::float AS profit
    FROM (
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
        AND s."occurredAt" >= ${start}
        AND s."occurredAt" <= ${end}
      GROUP BY p.id, p.name

      UNION ALL

      SELECT
        p.id AS "productId",
        p.name,
        COALESCE(SUM(csi.quantity * csi."unitPrice"), 0)::float AS revenue,
        COALESCE(SUM(csi.quantity * p.cost), 0)::float AS cost,
        COALESCE(SUM(csi.quantity * (csi."unitPrice" - p.cost)), 0)::float AS profit
      FROM "CreditSaleItem" csi
      INNER JOIN "CreditSale" cs ON cs.id = csi."creditSaleId"
      INNER JOIN "ProductVariation" pv ON pv.id = csi."productVariationId"
      INNER JOIN "Product" p ON p.id = pv."productId"
      WHERE csi."tenantId" = ${tenantId}
        AND cs.status = 'PAID'::"CreditSaleStatus"
        AND cs."occurredAt" >= ${start}
        AND cs."occurredAt" <= ${end}
      GROUP BY p.id, p.name
    ) combined
    GROUP BY "productId", name
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

/** Produtos sem venda paga ou crediário (não cancelado) no intervalo. */
export async function productsWithoutSalesInRange(tenantId, start, end) {
  const rows = await prisma.$queryRaw`
    SELECT
      p.id AS "productId",
      p.name
    FROM "Product" p
    LEFT JOIN "ProductVariation" pv
      ON pv."productId" = p.id AND pv."tenantId" = p."tenantId"
    LEFT JOIN (
      SELECT si."productVariationId" AS vid, si."tenantId", s."occurredAt" AS at
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s.id = si."saleId"
        AND s.status = 'PAID'::"SaleStatus"
        AND s."occurredAt" >= ${start}
        AND s."occurredAt" <= ${end}

      UNION ALL

      SELECT csi."productVariationId" AS vid, csi."tenantId", cs."occurredAt" AS at
      FROM "CreditSaleItem" csi
      INNER JOIN "CreditSale" cs
        ON cs.id = csi."creditSaleId"
        AND cs.status <> 'CANCELED'::"CreditSaleStatus"
        AND cs."occurredAt" >= ${start}
        AND cs."occurredAt" <= ${end}
    ) events ON events.vid = pv.id AND events."tenantId" = p."tenantId"
    WHERE p."tenantId" = ${tenantId}
    GROUP BY p.id, p.name
    HAVING MAX(events.at) IS NULL
    ORDER BY p.name
  `;
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name
  }));
}
