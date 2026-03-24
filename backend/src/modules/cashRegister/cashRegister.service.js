import { CashMovementType, CashRegisterStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

async function getExpectedValue(tx, tenantId, cashRegisterId, initialValue) {
  const movements = await tx.cashMovement.findMany({
    where: { tenantId, cashRegisterId }
  });

  const net = movements.reduce((acc, item) => {
    const val = Number(item.value);
    return item.type === CashMovementType.WITHDRAWAL ? acc - val : acc + val;
  }, 0);

  return Number(initialValue) + net;
}

export const cashRegisterService = {
  async current(tenantId) {
    return prisma.cashRegister.findFirst({
      where: { tenantId, status: CashRegisterStatus.OPEN },
      include: { movements: true },
      orderBy: { openedAt: "desc" }
    });
  },

  async open(tenantId, userId, initialValue) {
    const current = await this.current(tenantId);
    if (current) {
      const err = new Error("Ja existe um caixa aberto.");
      err.statusCode = 409;
      throw err;
    }

    return prisma.cashRegister.create({
      data: {
        tenantId,
        openedByUserId: userId,
        initialValue
      }
    });
  },

  async addMovement(tenantId, cashRegisterId, payload) {
    return prisma.$transaction(async (tx) => {
      const cashRegister = await tx.cashRegister.findFirst({
        where: { id: cashRegisterId, tenantId, status: CashRegisterStatus.OPEN }
      });
      if (!cashRegister) {
        const err = new Error("Caixa aberto nao encontrado.");
        err.statusCode = 404;
        throw err;
      }

      return tx.cashMovement.create({
        data: {
          tenantId,
          cashRegisterId,
          type: payload.type,
          value: payload.value,
          description: payload.description || null
        }
      });
    });
  },

  async close(tenantId, cashRegisterId, finalValue) {
    return prisma.$transaction(async (tx) => {
      const cashRegister = await tx.cashRegister.findFirst({
        where: { id: cashRegisterId, tenantId, status: CashRegisterStatus.OPEN }
      });
      if (!cashRegister) {
        const err = new Error("Caixa aberto nao encontrado.");
        err.statusCode = 404;
        throw err;
      }

      const expectedValue = await getExpectedValue(tx, tenantId, cashRegisterId, cashRegister.initialValue);

      return tx.cashRegister.update({
        where: { id: cashRegister.id },
        data: {
          finalValue,
          expectedValue,
          status: CashRegisterStatus.CLOSED,
          closedAt: new Date()
        }
      });
    });
  }
};
