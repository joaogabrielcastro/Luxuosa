import { prisma } from "../../config/prisma.js";
import { productService } from "../products/product.service.js";

export const dashboardService = {
  async admin(tenantId, { includeHeavy = true } = {}) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inactiveDays = 30;
    const noSalesSince = new Date(now);
    noSalesSince.setDate(noSalesSince.getDate() - inactiveDays);

    const [monthSales, daySales, lowStockItems, lastSales, paidSalesAgg, paidByUser, paidSaleItems, products] = await Promise.all([
      prisma.sale.findMany({
        where: { tenantId, status: "PAID", occurredAt: { gte: monthStart } },
        select: { totalValue: true, occurredAt: true }
      }),
      prisma.sale.count({
        where: { tenantId, status: "PAID", occurredAt: { gte: dayStart } }
      }),
      productService.lowStock(tenantId),
      prisma.sale.findMany({
        where: { tenantId, status: "PAID" },
        orderBy: { occurredAt: "desc" },
        take: 5,
        select: { id: true, totalValue: true, occurredAt: true, paymentMethod: true, user: { select: { name: true } } }
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
      includeHeavy
        ? prisma.saleItem.findMany({
            where: { tenantId, sale: { status: "PAID" } },
            select: {
              quantity: true,
              unitPrice: true,
              sale: { select: { occurredAt: true } },
              productVariation: {
                select: {
                  productId: true,
                  product: { select: { id: true, name: true, cost: true } }
                }
              }
            }
          })
        : Promise.resolve([]),
      includeHeavy
        ? prisma.product.findMany({
            where: { tenantId },
            select: {
              id: true,
              name: true,
              variations: { select: { stock: true } }
            }
          })
        : Promise.resolve([])
    ]);

    const monthlyRevenue = monthSales.reduce((acc, item) => acc + Number(item.totalValue), 0);
    const paidCount = Number(paidSalesAgg?._count?._all || 0);
    const paidTotal = Number(paidSalesAgg?._sum?.totalValue || 0);
    const ticketAverage = paidCount
      ? paidTotal / paidCount
      : 0;

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

    const salesByPeriodMap = new Map();
    for (const sale of monthSales) {
      const date = new Date(sale.occurredAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const current = salesByPeriodMap.get(key) || { date: key, amount: 0, count: 0 };
      current.amount += Number(sale.totalValue);
      current.count += 1;
      salesByPeriodMap.set(key, current);
    }
    const salesByPeriod = Array.from(salesByPeriodMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    const profitByProductMap = new Map();
    if (includeHeavy) {
      for (const item of paidSaleItems) {
        const product = item.productVariation?.product;
        if (!product) continue;
        const productId = product.id;
        const revenue = Number(item.unitPrice) * item.quantity;
        const cost = Number(product.cost) * item.quantity;
        const current = profitByProductMap.get(productId) || { productId, name: product.name, revenue: 0, cost: 0, profit: 0 };
        current.revenue += revenue;
        current.cost += cost;
        current.profit += revenue - cost;
        profitByProductMap.set(productId, current);
      }
    }
    const profitByProduct = Array.from(profitByProductMap.values()).sort((a, b) => b.profit - a.profit);

    const stockConsolidated = includeHeavy
      ? products
          .map((product) => ({
            productId: product.id,
            name: product.name,
            stock: product.variations.reduce((acc, variation) => acc + variation.stock, 0)
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    const lastSaleByProduct = new Map();
    if (includeHeavy) {
      for (const item of paidSaleItems) {
        const productId = item.productVariation?.productId;
        if (!productId || !item.sale?.occurredAt) continue;
        const current = lastSaleByProduct.get(productId);
        if (!current || new Date(item.sale.occurredAt) > new Date(current)) {
          lastSaleByProduct.set(productId, item.sale.occurredAt);
        }
      }
    }

    const productsWithoutSales = includeHeavy
      ? products
          .map((product) => ({
            productId: product.id,
            name: product.name,
            lastSaleAt: lastSaleByProduct.get(product.id) || null
          }))
          .filter((item) => !item.lastSaleAt || new Date(item.lastSaleAt) < noSalesSince)
      : [];

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
