import { PaymentMethod, SaleStatus, StockMovementType, CashMovementType, CashRegisterStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { saleRepository } from "./sale.repository.js";

function normalizePaymentMethod(method) {
  const map = {
    dinheiro: PaymentMethod.CASH,
    cartao_credito: PaymentMethod.CREDIT_CARD,
    cartao_debito: PaymentMethod.DEBIT_CARD,
    pix: PaymentMethod.PIX,
    parcelamento: PaymentMethod.INSTALLMENT
  };
  return map[method] || method;
}

export const saleService = {
  list(tenantId) {
    return saleRepository.list(tenantId);
  },

  async create(tenantId, userId, payload) {
    return prisma.$transaction(async (tx) => {
      const variationIds = payload.items.map((item) => item.productVariationId);
      const variations = await tx.productVariation.findMany({
        where: { tenantId, id: { in: variationIds } },
        include: { product: true }
      });

      if (variations.length !== variationIds.length) {
        const err = new Error("Uma ou mais variacoes nao pertencem ao tenant.");
        err.statusCode = 400;
        throw err;
      }

      const variationMap = new Map(variations.map((item) => [item.id, item]));
      const saleItems = payload.items.map((item) => {
        const variation = variationMap.get(item.productVariationId);
        if (!variation || variation.stock < item.quantity) {
          const err = new Error(`Estoque insuficiente para variacao ${item.productVariationId}.`);
          err.statusCode = 400;
          throw err;
        }
        return {
          productVariationId: item.productVariationId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice)
        };
      });

      const grossTotal = saleItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
      const discountValue = Number(payload.discountValue || 0);
      const discountPercent = Number(payload.discountPercent || 0);
      const percentDiscountValue = (grossTotal * discountPercent) / 100;
      const totalValue = Math.max(grossTotal - discountValue - percentDiscountValue, 0);

      const sale = await saleRepository.createWithItems(
        tx,
        tenantId,
        {
          customerId: payload.customerId || null,
          userId,
          totalValue,
          discountValue,
          discountPercent,
          paymentMethod: normalizePaymentMethod(payload.paymentMethod),
          installments: payload.installments || 1,
          status: SaleStatus.PAID
        },
        saleItems
      );

      for (const item of saleItems) {
        await tx.productVariation.updateMany({
          where: { tenantId, id: item.productVariationId },
          data: { stock: { decrement: item.quantity } }
        });
        await tx.stockMovement.create({
          data: {
            tenantId,
            productVariationId: item.productVariationId,
            type: StockMovementType.EXIT,
            quantity: item.quantity
          }
        });
      }

      if (payload.customerId) {
        await tx.customer.updateMany({
          where: { tenantId, id: payload.customerId },
          data: {
            totalPurchases: { increment: totalValue },
            lastPurchaseAt: new Date()
          }
        });
      }

      const openCash = await tx.cashRegister.findFirst({
        where: { tenantId, status: CashRegisterStatus.OPEN },
        orderBy: { openedAt: "desc" }
      });

      if (openCash) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashRegisterId: openCash.id,
            type: CashMovementType.ENTRY,
            value: totalValue,
            description: `Venda ${sale.id}`
          }
        });
      }

      return sale;
    });
  }
};
