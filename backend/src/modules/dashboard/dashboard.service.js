import { prisma } from "../../config/prisma.js";
import { productService } from "../products/product.service.js";

export const dashboardService = {
  async admin(tenantId) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [monthSales, daySales, lowStockItems, lastSales] = await Promise.all([
      prisma.sale.findMany({
        where: { tenantId, occurredAt: { gte: monthStart } },
        select: { totalValue: true }
      }),
      prisma.sale.count({
        where: { tenantId, occurredAt: { gte: dayStart } }
      }),
      productService.lowStock(tenantId),
      prisma.sale.findMany({
        where: { tenantId },
        orderBy: { occurredAt: "desc" },
        take: 5,
        select: { id: true, totalValue: true, occurredAt: true, paymentMethod: true }
      })
    ]);

    const monthlyRevenue = monthSales.reduce((acc, item) => acc + Number(item.totalValue), 0);

    return {
      monthlyRevenue,
      daySales,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      lastSales
    };
  }
};
