export class BaseTenantRepository {
  constructor(model) {
    this.model = model;
  }

  findMany(tenantId, where = {}, options = {}) {
    return this.model.findMany({
      where: { tenantId, ...where },
      ...options
    });
  }

  findUniqueById(tenantId, id, options = {}) {
    return this.model.findFirst({
      where: { id, tenantId },
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
      where: { id, tenantId },
      data,
      ...options
    });
  }

  delete(tenantId, id) {
    return this.model.deleteMany({
      where: { id, tenantId }
    });
  }
}
