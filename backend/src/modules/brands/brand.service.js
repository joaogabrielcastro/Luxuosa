import { brandRepository } from "./brand.repository.js";

export const brandService = {
  list(tenantId) {
    return brandRepository.findMany(tenantId, {}, { orderBy: { createdAt: "desc" } });
  },

  getById(tenantId, id) {
    return brandRepository.findUniqueById(tenantId, id);
  },

  create(tenantId, payload) {
    return brandRepository.create(tenantId, payload);
  },

  async update(tenantId, id, payload) {
    const result = await brandRepository.update(tenantId, id, payload);
    if (result.count === 0) {
      const err = new Error("Marca nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  },

  async remove(tenantId, id) {
    const result = await brandRepository.delete(tenantId, id);
    if (result.count === 0) {
      const err = new Error("Marca nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  }
};
