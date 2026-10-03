import { StockMovementType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AUDIT_ACTIONS, recordAuditInTx } from "../../shared/auditLog.js";

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

  async create(tenantId, payload, { userId } = {}) {
    const type = payload.type === "EXIT" ? StockMovementType.EXIT : StockMovementType.ENTRY;
    const qty = Math.floor(Number(payload.quantity));
    if (!Number.isInteger(qty) || qty < 1) {
      const err = new Error("Quantidade deve ser um inteiro maior ou igual a 1.");
      err.statusCode = 400;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const variation = await tx.productVariation.findFirst({
        where: { id: payload.productVariationId, tenantId },
        include: { product: true }
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

      const movement = await tx.stockMovement.create({
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

      const size = String(variation.size || "").trim();
      const color = String(variation.color || "").trim();
      const grade = size || color ? `${size || "—"}/${color || "—"}` : "padrao";
      const productName = variation.product?.name || "produto";
      await recordAuditInTx(tx, {
        tenantId,
        userId,
        action: type === StockMovementType.EXIT ? AUDIT_ACTIONS.STOCK_EXIT : AUDIT_ACTIONS.STOCK_ENTRY,
        entityType: "StockMovement",
        entityId: movement.id,
        summary: `${type === StockMovementType.EXIT ? "Saida" : "Entrada"} de ${qty} un. — ${productName} (${grade})`,
        meta: {
          productId: variation.productId,
          productVariationId: variation.id,
          quantity: qty,
          type
        }
      });

      return movement;
    });
  }
};
