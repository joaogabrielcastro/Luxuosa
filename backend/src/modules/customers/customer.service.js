import { prisma } from "../../config/prisma.js";
import { pagedResult } from "../../shared/pagination.js";
import { customerRepository } from "./customer.repository.js";

export const customerService = {
  async assertNoDuplicate(tenantId, payload, excludeId = null) {
    const checks = [];
    if (payload.cpfCnpj) checks.push({ cpfCnpj: payload.cpfCnpj });
    if (payload.phone) checks.push({ phone: payload.phone });
    if (payload.eventCode) checks.push({ eventCode: payload.eventCode });
    if (!checks.length) return;
    const duplicate = await prisma.customer.findFirst({
      where: {
        tenantId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: checks
      },
      select: { id: true, name: true, cpfCnpj: true, phone: true, eventCode: true }
    });
    if (duplicate) {
      const err = new Error(`Ja existe um cliente com o mesmo CPF, telefone ou codigo: ${duplicate.name}.`);
      err.statusCode = 409;
      err.code = "CUSTOMER_DUPLICATE";
      err.details = { customer: duplicate };
      throw err;
    }
  },
  async listPaged(tenantId, { take = 50, skip = 0, q } = {}) {
    const where = { tenantId };
    if (q) {
      const digits = q.replace(/\D/g, "");
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        ...(digits ? [{ cpfCnpj: { contains: digits } }, { phone: { contains: digits } }] : []),
        { eventCode: { contains: q, mode: "insensitive" } },
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

  async create(tenantId, payload) {
    await this.assertNoDuplicate(tenantId, payload);
    return customerRepository.create(tenantId, payload);
  },

  async update(tenantId, id, payload) {
    await this.assertNoDuplicate(tenantId, payload, id);
    const result = await customerRepository.update(tenantId, id, payload);
    if (result.count === 0) {
      const err = new Error("Cliente nao encontrado.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  },

  async remove(tenantId, id) {
    const customer = await prisma.customer.findFirst({
      where: { tenantId, id },
      select: { id: true, name: true }
    });
    if (!customer) {
      const err = new Error("Cliente nao encontrado.");
      err.statusCode = 404;
      throw err;
    }
    const [sales, creditSales] = await Promise.all([
      prisma.sale.count({ where: { tenantId, customerId: id } }),
      prisma.creditSale.count({ where: { tenantId, customerId: id } })
    ]);
    if (sales > 0 || creditSales > 0) {
      const err = new Error("Este cliente possui vendas ou crediario vinculados e nao pode ser excluido. Corrija o cadastro em vez de apagar.");
      err.statusCode = 409;
      err.code = "CUSTOMER_HAS_TRANSACTIONS";
      throw err;
    }
    const result = await customerRepository.delete(tenantId, id);
    if (result.count === 0) {
      const err = new Error("Cliente nao encontrado.");
      err.statusCode = 404;
      throw err;
    }
    return customer;
  }
};
