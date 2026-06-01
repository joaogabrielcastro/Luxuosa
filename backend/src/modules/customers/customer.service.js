import { prisma } from "../../config/prisma.js";
import { pagedResult } from "../../shared/pagination.js";
import { customerRepository } from "./customer.repository.js";

export const customerService = {
  async listPaged(tenantId, { take = 50, skip = 0, q } = {}) {
    const where = { tenantId };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { cpfCnpj: { contains: q.replace(/\D/g, "") } },
        { email: { contains: q, mode: "insensitive" } }
      ];
    }
    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      prisma.customer.count({ where })
    ]);
    return pagedResult(items, { total, take, skip });
  },

  list(tenantId) {
    return this.listPaged(tenantId, { take: 200, skip: 0 });
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
