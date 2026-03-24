import { categoryRepository } from "./category.repository.js";

export const categoryService = {
  list(tenantId) {
    return categoryRepository.findMany(tenantId, {}, { orderBy: { createdAt: "desc" } });
  },

  getById(tenantId, id) {
    return categoryRepository.findUniqueById(tenantId, id);
  },

  create(tenantId, payload) {
    return categoryRepository.create(tenantId, payload);
  },

  update(tenantId, id, payload) {
    return categoryRepository.update(tenantId, id, payload);
  },

  remove(tenantId, id) {
    return categoryRepository.delete(tenantId, id);
  }
};
