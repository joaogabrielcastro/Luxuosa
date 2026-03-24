import { prisma } from "../../config/prisma.js";
import { BaseTenantRepository } from "../../shared/baseTenantRepository.js";

class CategoryRepository extends BaseTenantRepository {
  constructor() {
    super(prisma.category);
  }
}

export const categoryRepository = new CategoryRepository();
