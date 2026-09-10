import { prisma } from "../../config/prisma.js";
import { BaseTenantRepository } from "../../shared/baseTenantRepository.js";

const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  type: true,
  createdAt: true,
  tenantId: true
};

class UserRepository extends BaseTenantRepository {
  constructor() {
    super(prisma.user);
  }

  listByTenant(tenantId) {
    return this.findMany(
      tenantId,
      {},
      {
        select: userPublicSelect,
        orderBy: { createdAt: "desc" }
      }
    );
  }

  findPublicById(tenantId, id) {
    return this.findUniqueById(tenantId, id, { select: userPublicSelect });
  }

  countByTenant(tenantId) {
    return this.model.count({ where: { tenantId } });
  }

  countAdmins(tenantId, excludeUserId) {
    return this.model.count({
      where: {
        tenantId,
        type: "ADMIN",
        ...(excludeUserId ? { id: { not: excludeUserId } } : {})
      }
    });
  }

  findByEmail(tenantId, email) {
    return this.model.findFirst({
      where: { tenantId, email },
      select: userPublicSelect
    });
  }
}

export const userRepository = new UserRepository();
export { userPublicSelect };
