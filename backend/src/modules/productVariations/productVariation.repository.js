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

    const productFilter = {
      ...(categoryId ? { categoryId } : {}),
      ...(brandId ? { brandId } : {})
    };

    if (q) {
      const searchOr = [
        { sku: { contains: q, mode: "insensitive" } },
        { product: { name: { contains: q, mode: "insensitive" } } },
        { product: { sku: { contains: q, mode: "insensitive" } } }
      ];
      if (Object.keys(productFilter).length) {
        where.AND = [{ product: productFilter }, { OR: searchOr }];
      } else {
        where.OR = searchOr;
      }
    } else if (Object.keys(productFilter).length) {
      where.product = productFilter;
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
