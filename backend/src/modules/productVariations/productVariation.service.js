import { prisma } from "../../config/prisma.js";
import { productVariationRepository } from "./productVariation.repository.js";

export const productVariationService = {
  list(tenantId) {
    return productVariationRepository.list(tenantId);
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
    return productVariationRepository.update(tenantId, id, payload);
  },

  remove(tenantId, id) {
    return productVariationRepository.remove(tenantId, id);
  }
};
