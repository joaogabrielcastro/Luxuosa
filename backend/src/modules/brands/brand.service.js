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

  update(tenantId, id, payload) {
    return brandRepository.update(tenantId, id, payload);
  },

  remove(tenantId, id) {
    return brandRepository.delete(tenantId, id);
  }
};
