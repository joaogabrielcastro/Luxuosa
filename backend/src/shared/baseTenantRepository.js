/**
 * Garante que o filtro Prisma inclui o tenantId (isolamento multi-tenant).
 * @param {Record<string, unknown>} where
 * @param {string} tenantId
 * @returns {Record<string, unknown>}
 */
export function assertTenantScope(where, tenantId) {
  if (!tenantId || typeof tenantId !== "string") {
    const err = new Error("tenantId obrigatorio para escopo multi-tenant.");
    err.statusCode = 500;
    throw err;
  }
  const base = where && typeof where === "object" ? where : {};
  if (base.tenantId && base.tenantId !== tenantId) {
    const err = new Error("tenantId no filtro diverge do escopo da requisicao.");
    err.statusCode = 403;
    throw err;
  }
  return { ...base, tenantId };
}

export class BaseTenantRepository {
  constructor(model) {
    this.model = model;
  }

  findMany(tenantId, where = {}, options = {}) {
    return this.model.findMany({
      where: assertTenantScope(where, tenantId),
      ...options
    });
  }

  findUniqueById(tenantId, id, options = {}) {
    return this.model.findFirst({
      where: assertTenantScope({ id }, tenantId),
      ...options
    });
  }

  create(tenantId, data, options = {}) {
    return this.model.create({
      data: { ...data, tenantId },
      ...options
    });
  }

  update(tenantId, id, data, options = {}) {
    return this.model.updateMany({
      where: assertTenantScope({ id }, tenantId),
      data,
      ...options
    });
  }

  delete(tenantId, id) {
    return this.model.deleteMany({
      where: assertTenantScope({ id }, tenantId)
    });
  }
}
