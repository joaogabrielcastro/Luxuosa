import { prisma } from "../../config/prisma.js";
import { BaseTenantRepository } from "../../shared/baseTenantRepository.js";

class BrandRepository extends BaseTenantRepository {
  constructor() {
    super(prisma.brand);
  }
}

export const brandRepository = new BrandRepository();
