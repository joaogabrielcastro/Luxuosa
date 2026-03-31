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
    return productVariationRepository.create(tenantId, payload);
  },

  async update(tenantId, id, payload) {
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
    const result = await productVariationRepository.update(tenantId, id, payload);
    if (result.count === 0) {
      const err = new Error("Variacao nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  },

  async remove(tenantId, id) {
    const result = await productVariationRepository.remove(tenantId, id);
    if (result.count === 0) {
      const err = new Error("Variacao nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  }
};
