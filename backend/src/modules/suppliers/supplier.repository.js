import { prisma } from "../../config/prisma.js";

export const supplierRepository = {
  list(tenantId) {
    return prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: "asc" }
    });
  },

  findById(tenantId, id) {
    return prisma.supplier.findFirst({ where: { tenantId, id } });
  },

  findByCnpj(tenantId, cnpj) {
    return prisma.supplier.findFirst({ where: { tenantId, cnpj } });
  },

  create(tenantId, data) {
    return prisma.supplier.create({
      data: { ...data, tenantId }
    });
  },

  update(tenantId, id, data) {
    return prisma.supplier.updateMany({
      where: { tenantId, id },
      data
    });
  }
};
