import { prisma } from "../../config/prisma.js";
import { productRepository } from "./product.repository.js";

export const productService = {
  list(tenantId) {
    return productRepository.list(tenantId);
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
    return productRepository.update(tenantId, id, payload);
  },

  remove(tenantId, id) {
    return productRepository.remove(tenantId, id);
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
          minStock: product.minStock,
          currentStock
        };
      })
      .filter((product) => product.currentStock <= product.minStock);
  }
};
