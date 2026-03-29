import { prisma } from "../../config/prisma.js";

export const productVariationRepository = {
  list(tenantId) {
    return prisma.productVariation.findMany({
      where: { tenantId },
      include: { product: { include: { category: true, brand: true } } },
      orderBy: { createdAt: "desc" }
    });
  },

  findById(tenantId, id) {
    return prisma.productVariation.findFirst({
      where: { tenantId, id },
      include: { product: { include: { category: true, brand: true } } }
    });
  },

  create(tenantId, data) {
    return prisma.productVariation.create({
      data: { ...data, tenantId }
    });
  },

  update(tenantId, id, data) {
    return prisma.productVariation.updateMany({
      where: { tenantId, id },
      data
    });
  },

  remove(tenantId, id) {
    return prisma.productVariation.deleteMany({
      where: { tenantId, id }
    });
  }
};
