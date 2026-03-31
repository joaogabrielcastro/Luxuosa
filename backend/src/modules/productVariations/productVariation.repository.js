import { prisma } from "../../config/prisma.js";

export const productVariationRepository = {
  list(tenantId) {
    return prisma.productVariation.findMany({
      where: { tenantId },
      include: { product: { include: { category: true, brand: true } } },
      orderBy: { createdAt: "desc" }
    });
  },

  async listPaged(tenantId, { take = 50, skip = 0, q, categoryId, brandId, productId } = {}) {
    const where = { tenantId };
    if (productId) where.productId = productId;
    if (categoryId || brandId || q) {
      where.product = {
        ...(categoryId ? { categoryId } : {}),
        ...(brandId ? { brandId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      };
    }

    const [items, total] = await Promise.all([
      prisma.productVariation.findMany({
        where,
        include: { product: { include: { category: true, brand: true } } },
        orderBy: { createdAt: "desc" },
        take,
        skip
      }),
      prisma.productVariation.count({ where })
    ]);
    return { items, total, take, skip };
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
