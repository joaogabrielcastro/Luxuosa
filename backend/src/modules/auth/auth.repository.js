import { prisma } from "../../config/prisma.js";

export const authRepository = {
  findUsersWithTenantByEmail(email) {
    return prisma.user.findMany({
      where: { email },
      include: { tenant: true }
    });
  }
};
