import { prisma } from "../../config/prisma.js";

export const saleRepository = {
  async list(tenantId, { skip = 0, take = 50, paymentMethod, nfce, q, summary = false } = {}) {
    const where = { tenantId };
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (nfce === "WAITING") where.invoice = null;
    else if (nfce) where.invoice = { status: nfce };
    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { invoice: { is: { key: { contains: q, mode: "insensitive" } } } }
      ];
    }

    const include = summary
      ? { invoice: true }
      : {
          customer: true,
          user: true,
          invoice: true,
          items: { include: { productVariation: { include: { product: true } } } }
        };

    const [items, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include,
        orderBy: { occurredAt: "desc" },
        skip,
        take
      }),
      prisma.sale.count({ where })
    ]);
    return { items, total };
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

  findByIdPlain(tenantId, id) {
    return prisma.sale.findFirst({
      where: { tenantId, id },
      include: {
        customer: true,
        user: true,
        invoice: true,
        items: { include: { productVariation: { include: { product: true } } } }
      }
    });
  },

  findForNfe(tenantId, saleId) {
    return prisma.sale.findFirst({
      where: { tenantId, id: saleId },
      include: {
        customer: true,
        invoice: true,
        items: { include: { productVariation: { include: { product: true } } } }
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
