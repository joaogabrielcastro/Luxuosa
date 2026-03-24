import { prisma } from "../../config/prisma.js";

export const saleRepository = {
  list(tenantId) {
    return prisma.sale.findMany({
      where: { tenantId },
      include: {
        customer: true,
        user: true,
        items: { include: { productVariation: { include: { product: true } } } }
      },
      orderBy: { occurredAt: "desc" }
    });
  },

  createWithItems(tx, tenantId, data, items) {
    return tx.sale.create({
      data: {
        ...data,
        tenantId,
        items: {
          create: items.map((item) => ({
            tenantId,
            productVariationId: item.productVariationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        }
      },
      include: {
        items: true
      }
    });
  }
};
