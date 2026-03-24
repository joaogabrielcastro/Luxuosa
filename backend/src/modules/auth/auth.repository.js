import { prisma } from "../../config/prisma.js";

export const authRepository = {
  findUserByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      include: { tenant: true }
    });
  }
};
