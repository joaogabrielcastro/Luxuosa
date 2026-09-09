import { CreditSaleStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { productService } from "../products/product.service.js";
import {
  crediarioOpenAggregated,
  productsWithoutSalesAggregated,
  profitByProductAggregated,
  salesByPeriodAggregated,
  stockConsolidatedAggregated
} from "./dashboard.queries.js";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const dashboardService = {
  async admin(tenantId, { includeHeavy = true } = {}) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inactiveDays = 30;
    const noSalesSince = new Date(now);
    noSalesSince.setDate(noSalesSince.getDate() - inactiveDays);

    const [
      monthAgg,
      daySales,
      lowStockItems,
      lastSales,
      paidSalesAgg,
      paidByUser,
      creditMonthPayments,
      creditDaySales,
      creditPaidAgg,
      crediarioOpen,
      creditByUser,
      salesByPeriod,
      profitByProduct,
      stockConsolidated,
      productsWithoutSales
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { tenantId, status: "PAID", occurredAt: { gte: monthStart } },
        _sum: { totalValue: true }
      }),
      prisma.sale.count({
        where: { tenantId, status: "PAID", occurredAt: { gte: dayStart } }
      }),
      productService.lowStock(tenantId),
      prisma.sale.findMany({
        where: { tenantId, status: "PAID" },
        orderBy: { occurredAt: "desc" },
        take: 5,
        select: {
          id: true,
          totalValue: true,
          occurredAt: true,
          paymentMethod: true,
          user: { select: { name: true } }
        }
      }),
      prisma.sale.aggregate({
        where: { tenantId, status: "PAID" },
        _sum: { totalValue: true },
        _count: { _all: true }
      }),
      prisma.sale.groupBy({
        by: ["userId"],
        where: { tenantId, status: "PAID" },
        _count: { _all: true },
        _sum: { totalValue: true }
      }),
      prisma.creditPayment.aggregate({
        where: { tenantId, paidAt: { gte: monthStart } },
        _sum: { amount: true }
      }),
      prisma.creditSale.count({
        where: {
          tenantId,
          status: { not: CreditSaleStatus.CANCELED },
          occurredAt: { gte: dayStart }
        }
      }),
      prisma.creditSale.aggregate({
        where: { tenantId, status: CreditSaleStatus.PAID },
        _sum: { totalValue: true },
        _count: { _all: true }
      }),
      crediarioOpenAggregated(tenantId),
      prisma.creditSale.groupBy({
        by: ["userId"],
        where: { tenantId, status: { in: [CreditSaleStatus.OPEN, CreditSaleStatus.PAID] } },
        _count: { _all: true },
        _sum: { totalValue: true }
      }),
      salesByPeriodAggregated(tenantId, monthStart),
      includeHeavy ? profitByProductAggregated(tenantId) : Promise.resolve([]),
      includeHeavy ? stockConsolidatedAggregated(tenantId) : Promise.resolve([]),
      includeHeavy ? productsWithoutSalesAggregated(tenantId, noSalesSince) : Promise.resolve([])
    ]);

    const monthlyRevenue =
      toNumber(monthAgg._sum.totalValue) + toNumber(creditMonthPayments._sum?.amount);
    const paidCount = toNumber(paidSalesAgg?._count?._all) + toNumber(creditPaidAgg?._count?._all);
    const paidTotal = toNumber(paidSalesAgg?._sum?.totalValue) + toNumber(creditPaidAgg?._sum?.totalValue);
    const ticketAverage = paidCount ? paidTotal / paidCount : 0;

    const byUser = new Map();
    for (const row of paidByUser) {
      byUser.set(row.userId, {
        userId: row.userId,
        sales: toNumber(row._count?._all),
        amount: toNumber(row._sum?.totalValue)
      });
    }
    for (const row of creditByUser) {
      const current = byUser.get(row.userId) || { userId: row.userId, sales: 0, amount: 0 };
      current.sales += toNumber(row._count?._all);
      current.amount += toNumber(row._sum?.totalValue);
      byUser.set(row.userId, current);
    }

    const userIds = [...byUser.keys()].filter(Boolean);
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { tenantId, id: { in: userIds } },
          select: { id: true, name: true }
        })
      : [];
    const userNameById = new Map(users.map((u) => [u.id, u.name]));
    const salesByAttendant = [...byUser.values()]
      .map((row) => ({
        userId: row.userId,
        name: userNameById.get(row.userId) || "Usuario removido",
        sales: row.sales,
        amount: row.amount
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      monthlyRevenue,
      daySales: daySales + creditDaySales,
      ticketAverage,
      crediarioOpenBalance: crediarioOpen.remaining,
      crediarioOpenCount: crediarioOpen.count,
      crediarioReceivedMonth: toNumber(creditMonthPayments._sum?.amount),
      lowStockCount: lowStockItems.length,
      lowStockItems,
      lastSales,
      salesByPeriod,
      salesByAttendant,
      profitByProduct,
      productsWithoutSales,
      stockConsolidated
    };
  }
};
