import { prisma } from "../../config/prisma.js";
import { productService } from "../products/product.service.js";

export const dashboardService = {
  async admin(tenantId) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inactiveDays = 30;
    const noSalesSince = new Date(now);
    noSalesSince.setDate(noSalesSince.getDate() - inactiveDays);

    const [monthSales, daySales, lowStockItems, lastSales, paidSales, paidSaleItems, products] = await Promise.all([
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
      prisma.sale.findMany({
        where: { tenantId, status: "PAID" },
        select: { id: true, totalValue: true, occurredAt: true, userId: true, user: { select: { name: true } } }
      }),
      prisma.saleItem.findMany({
        where: { tenantId, sale: { status: "PAID" } },
        include: { sale: { select: { occurredAt: true } }, productVariation: { include: { product: true } } }
      }),
      prisma.product.findMany({
        where: { tenantId },
        include: { variations: true }
      })
    ]);

    const monthlyRevenue = monthSales.reduce((acc, item) => acc + Number(item.totalValue), 0);
    const ticketAverage = paidSales.length
      ? paidSales.reduce((acc, sale) => acc + Number(sale.totalValue), 0) / paidSales.length
      : 0;

    const salesByAttendantMap = new Map();
    for (const sale of paidSales) {
      const current = salesByAttendantMap.get(sale.userId) || { userId: sale.userId, name: sale.user.name, sales: 0, amount: 0 };
      current.sales += 1;
      current.amount += Number(sale.totalValue);
      salesByAttendantMap.set(sale.userId, current);
    }
    const salesByAttendant = Array.from(salesByAttendantMap.values()).sort((a, b) => b.amount - a.amount);

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
    const profitByProduct = Array.from(profitByProductMap.values()).sort((a, b) => b.profit - a.profit);

    const stockConsolidated = products
      .map((product) => ({
        productId: product.id,
        name: product.name,
        stock: product.variations.reduce((acc, variation) => acc + variation.stock, 0)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const lastSaleByProduct = new Map();
    for (const item of paidSaleItems) {
      const productId = item.productVariation?.productId;
      if (!productId || !item.sale?.occurredAt) continue;
      const current = lastSaleByProduct.get(productId);
      if (!current || new Date(item.sale.occurredAt) > new Date(current)) {
        lastSaleByProduct.set(productId, item.sale.occurredAt);
      }
    }

    const productsWithoutSales = products
      .map((product) => ({
        productId: product.id,
        name: product.name,
        lastSaleAt: lastSaleByProduct.get(product.id) || null
      }))
      .filter((item) => !item.lastSaleAt || new Date(item.lastSaleAt) < noSalesSince);

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
