import { customerRepository } from "./customer.repository.js";

export const customerService = {
  list(tenantId) {
    return customerRepository.findMany(tenantId, {}, { orderBy: { createdAt: "desc" } });
  },

  getById(tenantId, id) {
    return customerRepository.findUniqueById(tenantId, id);
  },

  create(tenantId, payload) {
    return customerRepository.create(tenantId, payload);
  },

  async update(tenantId, id, payload) {
    const result = await customerRepository.update(tenantId, id, payload);
    if (result.count === 0) {
      const err = new Error("Cliente nao encontrado.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  },

  async remove(tenantId, id) {
    const result = await customerRepository.delete(tenantId, id);
    if (result.count === 0) {
      const err = new Error("Cliente nao encontrado.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  }
};
