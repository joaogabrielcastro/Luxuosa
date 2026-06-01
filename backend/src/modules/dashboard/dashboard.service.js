import { prisma } from "../../config/prisma.js";
import { productService } from "../products/product.service.js";
import {
  productsWithoutSalesAggregated,
  profitByProductAggregated,
  salesByPeriodAggregated,
  stockConsolidatedAggregated
} from "./dashboard.queries.js";

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
      salesByPeriodAggregated(tenantId, monthStart),
      includeHeavy ? profitByProductAggregated(tenantId) : Promise.resolve([]),
      includeHeavy ? stockConsolidatedAggregated(tenantId) : Promise.resolve([]),
      includeHeavy ? productsWithoutSalesAggregated(tenantId, noSalesSince) : Promise.resolve([])
    ]);

    const monthlyRevenue = Number(monthAgg._sum.totalValue || 0);
    const paidCount = Number(paidSalesAgg?._count?._all || 0);
    const paidTotal = Number(paidSalesAgg?._sum?.totalValue || 0);
    const ticketAverage = paidCount ? paidTotal / paidCount : 0;

    const userIds = paidByUser.map((row) => row.userId).filter(Boolean);
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { tenantId, id: { in: userIds } },
          select: { id: true, name: true }
        })
      : [];
    const userNameById = new Map(users.map((u) => [u.id, u.name]));
    const salesByAttendant = paidByUser
      .map((row) => ({
        userId: row.userId,
        name: userNameById.get(row.userId) || "Usuario removido",
        sales: Number(row._count?._all || 0),
        amount: Number(row._sum?.totalValue || 0)
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      monthlyRevenue,
      daySales,
      ticketAverage,
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
