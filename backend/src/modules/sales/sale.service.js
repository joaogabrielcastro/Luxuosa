import { PaymentMethod, SaleStatus, StockMovementType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { enqueueNfceIssue } from "../../jobs/enqueueNfceIssue.js";
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

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function assertDiscountPolicy(userType, discountValue, discountPercent, grossTotal) {
  if (discountValue < 0 || discountPercent < 0) {
    const err = new Error("Descontos nao podem ser negativos.");
    err.statusCode = 400;
    throw err;
  }

  if (discountPercent > 100) {
    const err = new Error("Desconto percentual nao pode ser maior que 100.");
    err.statusCode = 400;
    throw err;
  }

  if (userType === "ATTENDANT") {
    const maxPercent = 10;
    const maxValue = grossTotal * (maxPercent / 100);
    if (discountPercent > maxPercent || discountValue > maxValue) {
      const err = new Error("Atendente pode aplicar no maximo 10% de desconto.");
      err.statusCode = 403;
      throw err;
    }
  }
}

function assertInstallmentPolicy(paymentMethod, installments) {
  if (paymentMethod === PaymentMethod.INSTALLMENT && installments <= 1) {
    const err = new Error("Parcelamento exige no minimo 2 parcelas.");
    err.statusCode = 400;
    throw err;
  }
  if (paymentMethod !== PaymentMethod.INSTALLMENT && installments !== 1) {
    const err = new Error("Somente vendas parceladas podem ter mais de 1 parcela.");
    err.statusCode = 400;
    throw err;
  }
}

async function restoreSaleEffects(tx, tenantId, sale) {
  for (const item of sale.items) {
    await tx.productVariation.updateMany({
      where: { tenantId, id: item.productVariationId },
      data: { stock: { increment: item.quantity } }
    });
    await tx.stockMovement.create({
      data: {
        tenantId,
        productVariationId: item.productVariationId,
        type: StockMovementType.ENTRY,
        quantity: item.quantity
      }
    });
  }

  if (sale.customerId) {
    const totalValue = toNumber(sale.totalValue);
    await tx.customer.updateMany({
      where: { tenantId, id: sale.customerId },
      data: {
        totalPurchases: { decrement: totalValue }
      }
    });
  }
}

export const saleService = {
  list(tenantId) {
    return saleRepository.list(tenantId);
  },

  async create(tenantId, userId, userType, payload) {
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
      const discountValue = toNumber(payload.discountValue, 0);
      const discountPercent = toNumber(payload.discountPercent, 0);
      assertDiscountPolicy(userType, discountValue, discountPercent, grossTotal);
      const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
      const installments = Number(payload.installments || 1);
      assertInstallmentPolicy(paymentMethod, installments);
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
          paymentMethod,
          installments,
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

      return sale;
    }).then((sale) => {
      enqueueNfceIssue(tenantId, sale.id);
      return sale;
    });
  },

  async update(tenantId, saleId, userId, userType, payload) {
    return prisma.$transaction(async (tx) => {
      const currentSale = await saleRepository.findById(tx, tenantId, saleId);
      if (!currentSale) {
        const err = new Error("Venda nao encontrada.");
        err.statusCode = 404;
        throw err;
      }
      if (currentSale.status === SaleStatus.CANCELED) {
        const err = new Error("Nao e possivel editar venda cancelada.");
        err.statusCode = 409;
        throw err;
      }

      await restoreSaleEffects(tx, tenantId, currentSale);

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
      const discountValue = toNumber(payload.discountValue, 0);
      const discountPercent = toNumber(payload.discountPercent, 0);
      assertDiscountPolicy(userType, discountValue, discountPercent, grossTotal);
      const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
      const installments = Number(payload.installments || 1);
      assertInstallmentPolicy(paymentMethod, installments);
      const percentDiscountValue = (grossTotal * discountPercent) / 100;
      const totalValue = Math.max(grossTotal - discountValue - percentDiscountValue, 0);

      const updatedSale = await saleRepository.updateWithItems(
        tx,
        tenantId,
        saleId,
        {
          customerId: payload.customerId || null,
          userId,
          totalValue,
          discountValue,
          discountPercent,
          paymentMethod,
          installments,
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

      return updatedSale;
    });
  },

  async cancel(tenantId, saleId) {
    return prisma.$transaction(async (tx) => {
      const currentSale = await saleRepository.findById(tx, tenantId, saleId);
      if (!currentSale) {
        const err = new Error("Venda nao encontrada.");
        err.statusCode = 404;
        throw err;
      }
      if (currentSale.status === SaleStatus.CANCELED) {
        return currentSale;
      }

      await restoreSaleEffects(tx, tenantId, currentSale);

      return tx.sale.update({
        where: { id: currentSale.id },
        data: { status: SaleStatus.CANCELED }
      });
    });
  }
};
