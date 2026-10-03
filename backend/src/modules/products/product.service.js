import { prisma } from "../../config/prisma.js";
import { productRepository } from "./product.repository.js";
import { AUDIT_ACTIONS, safeRecordAudit } from "../../shared/auditLog.js";

export const productService = {
  list(tenantId) {
    return productRepository.list(tenantId);
  },

  listPaged(tenantId, options) {
    return productRepository.listPaged(tenantId, options);
  },

  getById(tenantId, id) {
    return productRepository.findById(tenantId, id);
  },

  async create(tenantId, payload, { userId } = {}) {
    const category = await prisma.category.findFirst({
      where: { id: payload.categoryId, tenantId }
    });
    if (!category) {
      const err = new Error("Categoria invalida para este tenant.");
      err.statusCode = 400;
      throw err;
    }
    const brand = await prisma.brand.findFirst({
      where: { id: payload.brandId, tenantId }
    });
    if (!brand) {
      const err = new Error("Marca invalida para este tenant.");
      err.statusCode = 400;
      throw err;
    }
    const product = await productRepository.create(tenantId, payload);
    safeRecordAudit({
      tenantId,
      userId,
      action: AUDIT_ACTIONS.PRODUCT_CREATED,
      entityType: "Product",
      entityId: product.id,
      summary: `Produto criado: ${product.name}`,
      meta: {
        name: product.name,
        sku: product.sku,
        price: Number(product.price),
        cost: Number(product.cost)
      }
    });
    return product;
  },

  async update(tenantId, id, payload, { userId } = {}) {
    if (payload.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: payload.categoryId, tenantId }
      });
      if (!category) {
        const err = new Error("Categoria invalida para este tenant.");
        err.statusCode = 400;
        throw err;
      }
    }
    if (payload.brandId) {
      const brand = await prisma.brand.findFirst({
        where: { id: payload.brandId, tenantId }
      });
      if (!brand) {
        const err = new Error("Marca invalida para este tenant.");
        err.statusCode = 400;
        throw err;
      }
    }

    const before = await prisma.product.findFirst({
      where: { tenantId, id },
      select: { id: true, name: true, price: true, cost: true }
    });
    if (!before) {
      const err = new Error("Produto nao encontrado.");
      err.statusCode = 404;
      throw err;
    }

    const result = await productRepository.update(tenantId, id, payload);
    if (result.count === 0) {
      const err = new Error("Produto nao encontrado.");
      err.statusCode = 404;
      throw err;
    }

    if (payload.price !== undefined && Number(payload.price) !== Number(before.price)) {
      safeRecordAudit({
        tenantId,
        userId,
        action: AUDIT_ACTIONS.PRODUCT_PRICE_CHANGED,
        entityType: "Product",
        entityId: id,
        summary: `Preco alterado: ${before.name} (${Number(before.price)} → ${Number(payload.price)})`,
        meta: { from: Number(before.price), to: Number(payload.price) }
      });
    }
    if (payload.cost !== undefined && Number(payload.cost) !== Number(before.cost)) {
      safeRecordAudit({
        tenantId,
        userId,
        action: AUDIT_ACTIONS.PRODUCT_COST_CHANGED,
        entityType: "Product",
        entityId: id,
        summary: `Custo alterado: ${before.name} (${Number(before.cost)} → ${Number(payload.cost)})`,
        meta: { from: Number(before.cost), to: Number(payload.cost) }
      });
    }

    return result;
  },

  async remove(tenantId, id) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { tenantId, id },
        include: { variations: { select: { id: true } } }
      });
      if (!product) {
        const err = new Error("Produto nao encontrado.");
        err.statusCode = 404;
        throw err;
      }

      const varIds = product.variations.map((v) => v.id);
      if (varIds.length > 0) {
        const [saleItems, creditItems] = await Promise.all([
          tx.saleItem.count({ where: { tenantId, productVariationId: { in: varIds } } }),
          tx.creditSaleItem.count({ where: { tenantId, productVariationId: { in: varIds } } })
        ]);
        if (saleItems > 0 || creditItems > 0) {
          const err = new Error(
            "Nao e possivel excluir produto com vendas ou crediario vinculados as variacoes."
          );
          err.statusCode = 409;
          throw err;
        }

        await tx.stockMovement.deleteMany({
          where: { tenantId, productVariationId: { in: varIds } }
        });
        await tx.productVariation.deleteMany({
          where: { tenantId, productId: id }
        });
      }

      const deleted = await tx.product.deleteMany({ where: { tenantId, id } });
      return deleted;
    });
  },

  async lowStock(tenantId) {
    const products = await productRepository.findLowStock(tenantId);

    return products
      .map((product) => {
        const currentStock = product.variations.reduce((acc, item) => acc + item.stock, 0);
        const severity = currentStock === 0 ? "critical" : "low";
        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category?.name || null,
          brand: product.brand?.name || null,
          minStock: product.minStock,
          currentStock,
          severity
        };
      })
      .filter((product) => product.currentStock <= product.minStock);
  }
};
