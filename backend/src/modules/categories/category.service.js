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

  async update(tenantId, id, payload) {
    const result = await categoryRepository.update(tenantId, id, payload);
    if (result.count === 0) {
      const err = new Error("Categoria nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  },

  async remove(tenantId, id) {
    const result = await categoryRepository.delete(tenantId, id);
    if (result.count === 0) {
      const err = new Error("Categoria nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  }
};
