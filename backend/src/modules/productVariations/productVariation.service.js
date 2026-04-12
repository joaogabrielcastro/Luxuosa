import { prisma } from "../../config/prisma.js";
import { productVariationRepository } from "./productVariation.repository.js";

export const productVariationService = {
  list(tenantId) {
    return productVariationRepository.list(tenantId);
  },

  listPaged(tenantId, options) {
    return productVariationRepository.listPaged(tenantId, options);
  },

  getById(tenantId, id) {
    return productVariationRepository.findById(tenantId, id);
  },

  async create(tenantId, payload) {
    const product = await prisma.product.findFirst({
      where: { id: payload.productId, tenantId }
    });
    if (!product) {
      const err = new Error("Produto invalido para este tenant.");
      err.statusCode = 400;
      throw err;
    }
    const data = { ...payload };
    if (product.trackByUnit) {
      data.stock = 0;
    }
    return productVariationRepository.create(tenantId, data);
  },

  async update(tenantId, id, payload) {
    const existing = await prisma.productVariation.findFirst({
      where: { tenantId, id },
      include: { product: true }
    });
    if (!existing) {
      const err = new Error("Variacao nao encontrada.");
      err.statusCode = 404;
      throw err;
    }

    if (payload.productId) {
      const product = await prisma.product.findFirst({
        where: { id: payload.productId, tenantId }
      });
      if (!product) {
        const err = new Error("Produto invalido para este tenant.");
        err.statusCode = 400;
        throw err;
      }
    }

    const data = { ...payload };
    const productRef = await prisma.product.findFirst({
      where: { id: payload.productId || existing.productId, tenantId }
    });
    if (productRef?.trackByUnit && data.stock !== undefined) {
      delete data.stock;
    }

    const result = await productVariationRepository.update(tenantId, id, data);
    if (result.count === 0) {
      const err = new Error("Variacao nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  },

  async remove(tenantId, id) {
    return prisma.$transaction(async (tx) => {
      const variation = await tx.productVariation.findFirst({
        where: { tenantId, id },
        select: { id: true }
      });
      if (!variation) {
        const err = new Error("Variacao nao encontrada.");
        err.statusCode = 404;
        throw err;
      }

      const [saleItems, creditItems, unitCount] = await Promise.all([
        tx.saleItem.count({ where: { tenantId, productVariationId: id } }),
        tx.creditSaleItem.count({ where: { tenantId, productVariationId: id } }),
        tx.stockUnit.count({ where: { tenantId, productVariationId: id } })
      ]);
      if (saleItems > 0 || creditItems > 0) {
        const err = new Error(
          "Nao e possivel excluir variacao com vendas ou crediario vinculados."
        );
        err.statusCode = 409;
        throw err;
      }
      if (unitCount > 0) {
        const err = new Error(
          "Remova as unidades (codigos de barras) desta variacao antes de excluir."
        );
        err.statusCode = 409;
        throw err;
      }

      await tx.stockMovement.deleteMany({
        where: { tenantId, productVariationId: id }
      });
      return tx.productVariation.deleteMany({ where: { tenantId, id } });
    });
  }
};
