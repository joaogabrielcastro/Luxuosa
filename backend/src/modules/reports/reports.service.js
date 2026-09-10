import { prisma } from "../../config/prisma.js";
import { FEATURE_MIN_PLAN, tenantMeetsPlan } from "../../shared/planCatalog.js";
import { productService } from "../products/product.service.js";
import { profitByProductInRange, productsWithoutSalesInRange } from "../dashboard/dashboard.queries.js";

function parseRange(fromStr, toStr) {
  if (!fromStr || !toStr) {
    const err = new Error("Informe from e to no formato YYYY-MM-DD.");
    err.statusCode = 400;
    throw err;
  }
  const start = new Date(`${fromStr}T00:00:00`);
  const end = new Date(`${toStr}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const err = new Error("Datas invalidas.");
    err.statusCode = 400;
    throw err;
  }
  if (start > end) {
    const err = new Error("A data inicial nao pode ser maior que a final.");
    err.statusCode = 400;
    throw err;
  }
  return { start, end };
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function previousWindow(start, end) {
  const durationMs = Math.max(end.getTime() - start.getTime(), 0);
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { prevStart, prevEnd };
}

export const reportsService = {
  async salesByPeriod(tenantId, fromStr, toStr) {
    const { start, end } = parseRange(fromStr, toStr);
    const [sales, agg, tenant] = await Promise.all([
      prisma.sale.findMany({
        where: {
          tenantId,
          status: "PAID",
          occurredAt: { gte: start, lte: end }
        },
        select: { totalValue: true, occurredAt: true, paymentMethod: true, userId: true }
      }),
      prisma.sale.aggregate({
        where: {
          tenantId,
          status: "PAID",
          occurredAt: { gte: start, lte: end }
        },
        _sum: { totalValue: true },
        _count: { _all: true }
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true, planGateExempt: true }
      })
    ]);

    const totalAmount = Number(agg?._sum?.totalValue || 0);
    const saleCount = Number(agg?._count?._all || 0);
    const ticketAverage = saleCount ? totalAmount / saleCount : 0;
    const byDayMap = new Map();
    const byPaymentMap = new Map();
    const byUserMap = new Map();
    for (const s of sales) {
      const d = new Date(s.occurredAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const cur = byDayMap.get(key) || { date: key, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(s.totalValue);
      byDayMap.set(key, cur);

      const method = s.paymentMethod || "OTHER";
      const pay = byPaymentMap.get(method) || { method, count: 0, amount: 0 };
      pay.count += 1;
      pay.amount += Number(s.totalValue);
      byPaymentMap.set(method, pay);

      const uid = s.userId || "";
      const att = byUserMap.get(uid) || { userId: s.userId || null, sales: 0, amount: 0 };
      att.sales += 1;
      att.amount += Number(s.totalValue);
      byUserMap.set(uid, att);
    }
    const byDay = Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const byPayment = Array.from(byPaymentMap.values()).sort((a, b) => b.amount - a.amount);

    const userIds = [...byUserMap.values()].map((row) => row.userId).filter(Boolean);
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { tenantId, id: { in: userIds } },
          select: { id: true, name: true }
        })
      : [];
    const userNameById = new Map(users.map((u) => [u.id, u.name]));
    const byAttendant = [...byUserMap.values()]
      .map((row) => ({
        userId: row.userId,
        name: row.userId ? userNameById.get(row.userId) || "Usuario removido" : "Sem atendente",
        sales: row.sales,
        amount: row.amount
      }))
      .sort((a, b) => b.amount - a.amount);

    const includeAdvanced = tenantMeetsPlan(tenant, FEATURE_MIN_PLAN.advancedReports);
    let advanced = null;
    if (includeAdvanced) {
      const { prevStart, prevEnd } = previousWindow(start, end);
      const [prevAgg, profitByProduct, idle] = await Promise.all([
        prisma.sale.aggregate({
          where: {
            tenantId,
            status: "PAID",
            occurredAt: { gte: prevStart, lte: prevEnd }
          },
          _sum: { totalValue: true },
          _count: { _all: true }
        }),
        profitByProductInRange(tenantId, start, end),
        productsWithoutSalesInRange(tenantId, start, end)
      ]);
      const prevCount = Number(prevAgg?._count?._all || 0);
      const prevAmount = Number(prevAgg?._sum?.totalValue || 0);
      advanced = {
        previous: {
          from: ymd(prevStart),
          to: ymd(prevEnd),
          saleCount: prevCount,
          totalAmount: prevAmount
        },
        profitByProduct: profitByProduct.slice(0, 20),
        productsWithoutSales: idle.slice(0, 20)
      };
    }

    return {
      from: fromStr,
      to: toStr,
      saleCount,
      totalAmount,
      ticketAverage,
      byDay,
      byPayment,
      byAttendant,
      advanced
    };
  },

  async lowStock(tenantId) {
    const items = await productService.lowStock(tenantId);
    return { count: items.length, items };
  }
};
