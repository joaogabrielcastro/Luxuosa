import { prisma } from "../../config/prisma.js";

export const productRepository = {
  list(tenantId) {
    return prisma.product.findMany({
      where: { tenantId },
      include: { category: true, brand: true, variations: true },
      orderBy: { createdAt: "desc" }
    });
  },

  async listPaged(tenantId, { take = 50, skip = 0, q, categoryId, brandId } = {}) {
    const where = { tenantId };
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true, brand: true, variations: true },
        orderBy: { createdAt: "desc" },
        take,
        skip
      }),
      prisma.product.count({ where })
    ]);
    return { items, total, take, skip };
  },

  findById(tenantId, id) {
    return prisma.product.findFirst({
      where: { tenantId, id },
      include: { category: true, brand: true, variations: true }
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
      include: { category: true, brand: true, variations: true },
      orderBy: { createdAt: "desc" }
    });
  }
};
