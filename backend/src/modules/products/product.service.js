import { prisma } from "../../config/prisma.js";
import { productRepository } from "./product.repository.js";

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
    const result = await productRepository.update(tenantId, id, payload);
    if (result.count === 0) {
      const err = new Error("Produto nao encontrado.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  },

  async remove(tenantId, id) {
    const result = await productRepository.remove(tenantId, id);
    if (result.count === 0) {
      const err = new Error("Produto nao encontrado.");
      err.statusCode = 404;
      throw err;
    }
    return result;
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
