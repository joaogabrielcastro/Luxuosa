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

  update(tenantId, id, payload) {
    return customerRepository.update(tenantId, id, payload);
  },

  remove(tenantId, id) {
    return customerRepository.delete(tenantId, id);
  }
};
