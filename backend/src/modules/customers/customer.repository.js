import { prisma } from "../../config/prisma.js";
import { BaseTenantRepository } from "../../shared/baseTenantRepository.js";

class CustomerRepository extends BaseTenantRepository {
  constructor() {
    super(prisma.customer);
  }
}

export const customerRepository = new CustomerRepository();
