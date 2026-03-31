import { StockMovementType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

export const stockMovementService = {
  list(tenantId, { take = 100, skip = 0 } = {}) {
    const limit = Math.min(Math.max(Number(take) || 100, 1), 500);
    const offset = Math.max(Number(skip) || 0, 0);
    return prisma.stockMovement.findMany({
      where: { tenantId },
      orderBy: { occurredAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        productVariation: {
          include: { product: { include: { category: true, brand: true } } }
        }
      }
    });
  },

  async create(tenantId, payload) {
    const type = payload.type === "EXIT" ? StockMovementType.EXIT : StockMovementType.ENTRY;
    const qty = Math.floor(Number(payload.quantity));
    if (!Number.isInteger(qty) || qty < 1) {
      const err = new Error("Quantidade deve ser um inteiro maior ou igual a 1.");
      err.statusCode = 400;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const variation = await tx.productVariation.findFirst({
        where: { id: payload.productVariationId, tenantId }
      });
      if (!variation) {
        const err = new Error("Variacao nao encontrada nesta loja.");
        err.statusCode = 404;
        throw err;
      }

      if (type === StockMovementType.EXIT && variation.stock < qty) {
        const err = new Error(`Estoque insuficiente. Disponivel: ${variation.stock}.`);
        err.statusCode = 400;
        throw err;
      }

      await tx.productVariation.update({
        where: { id: variation.id },
        data: {
          stock: type === StockMovementType.EXIT ? { decrement: qty } : { increment: qty }
        }
      });

      return tx.stockMovement.create({
        data: {
          tenantId,
          productVariationId: variation.id,
          type,
          quantity: qty
        },
        include: {
          productVariation: { include: { product: { include: { category: true, brand: true } } } }
        }
      });
    });
  }
};
