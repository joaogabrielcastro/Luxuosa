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
  },

  findById(tx, tenantId, id) {
    return tx.sale.findFirst({
      where: { tenantId, id },
      include: {
        customer: true,
        items: true
      }
    });
  },

  updateWithItems(tx, tenantId, saleId, data, items) {
    return tx.sale.update({
      where: { id: saleId },
      data: {
        ...data,
        items: {
          deleteMany: { tenantId, saleId },
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
