import { StockUnitStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { productRepository } from "./product.repository.js";

async function assertTrackByUnitToggle(tenantId, productId, wasTrackByUnit, nextTrackByUnit) {
  if (wasTrackByUnit === nextTrackByUnit) return;

  const variations = await prisma.productVariation.findMany({
    where: { tenantId, productId },
    select: { id: true, stock: true }
  });

  if (nextTrackByUnit === true) {
    const hasStock = variations.some((v) => v.stock > 0);
    if (hasStock) {
      const err = new Error(
        "Para ativar rastreio por peca, o estoque numerico das variacoes deve estar zero. Ajuste ou cadastre unidades com codigo de barras."
      );
      err.statusCode = 400;
      throw err;
    }
    return;
  }

  const available = await prisma.stockUnit.count({
    where: {
      tenantId,
      status: StockUnitStatus.AVAILABLE,
      productVariationId: { in: variations.map((v) => v.id) }
    }
  });
  if (available > 0) {
    const err = new Error(
      "Para desativar rastreio por peca, remova ou venda todas as unidades ainda disponiveis (codigos em estoque)."
    );
    err.statusCode = 400;
    throw err;
  }
}

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

  async create(tenantId, payload) {
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
    return productRepository.create(tenantId, payload);
  },

  async update(tenantId, id, payload) {
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

    if (payload.trackByUnit !== undefined) {
      const current = await prisma.product.findFirst({
        where: { tenantId, id },
        select: { trackByUnit: true }
      });
      if (!current) {
        const err = new Error("Produto nao encontrado.");
        err.statusCode = 404;
        throw err;
      }
      await assertTrackByUnitToggle(tenantId, id, current.trackByUnit, payload.trackByUnit);
    }

    const result = await productRepository.update(tenantId, id, payload);
    if (result.count === 0) {
      const err = new Error("Produto nao encontrado.");
      err.statusCode = 404;
      throw err;
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
        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category?.name || null,
          brand: product.brand?.name || null,
          minStock: product.minStock,
          currentStock
        };
      })
      .filter((product) => product.currentStock <= product.minStock);
  }
};
