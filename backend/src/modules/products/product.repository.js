import { prisma } from "../../config/prisma.js";

export const productRepository = {
  list(tenantId) {
    return prisma.product.findMany({
      where: { tenantId },
      include: { category: true, variations: true },
      orderBy: { createdAt: "desc" }
    });
  },

  findById(tenantId, id) {
    return prisma.product.findFirst({
      where: { tenantId, id },
      include: { category: true, variations: true }
    });
  },

  create(tenantId, data) {
    return prisma.product.create({
      data: { ...data, tenantId }
    });
  },

  update(tenantId, id, data) {
    return prisma.product.updateMany({
      where: { tenantId, id },
      data
    });
  },

  remove(tenantId, id) {
    return prisma.product.deleteMany({
      where: { tenantId, id }
    });
  },

  findLowStock(tenantId) {
    return prisma.product.findMany({
      where: { tenantId },
      include: { category: true, variations: true },
      orderBy: { createdAt: "desc" }
    });
  }
};
