import { PaymentMethod, SaleStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { enqueueNfceIssue } from "../../jobs/enqueueNfceIssue.js";
import { assertSaleMutable } from "../../shared/saleGuards.js";
import {
  assertCustomerBelongsToTenant,
  assertNoDuplicateVariationLines,
  normalizePaymentMethod
} from "../../shared/salePayload.js";
import {
  applyStockExitForLine,
  buildAndValidateSaleLineItems,
  restoreStockForLine
} from "../../shared/saleStockLineItems.js";
import { saleRepository } from "./sale.repository.js";

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
    await restoreStockForLine(tx, tenantId, item);
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
  async list(tenantId, { skip = 0, take = 50, paymentMethod, nfce, q, summary = false } = {}) {
    const { items, total } = await saleRepository.list(tenantId, {
      skip,
      take,
      paymentMethod,
      nfce,
      q,
      summary
    });
    const sales = items;
    if (!sales.length) return { items: [], total, skip, take };

    const saleIds = sales.map((s) => s.id);
    const jobs = await prisma.nfceIssueJob.findMany({
      where: { tenantId, saleId: { in: saleIds } },
      select: { saleId: true, status: true, attempts: true, runAt: true, updatedAt: true, lastError: true }
    });
    const jobsBySale = new Map(jobs.map((j) => [j.saleId, j]));

    const enriched = sales.map((sale) => ({
      ...sale,
      nfceJob: jobsBySale.get(sale.id) || null
    }));
    return { items: enriched, total, skip, take };
  },

  getById(tenantId, saleId) {
    return saleRepository.findByIdPlain(tenantId, saleId);
  },

  async create(tenantId, userId, userType, payload) {
    return prisma.$transaction(async (tx) => {
      assertNoDuplicateVariationLines(payload.items);
      await assertCustomerBelongsToTenant(tx, tenantId, payload.customerId);

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
      const saleItems = buildAndValidateSaleLineItems(payload.items, variationMap);

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
        await applyStockExitForLine(tx, tenantId, item);
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

      const wantsNfce = payload.emitNfce === undefined ? true : payload.emitNfce === true;
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { enableNfceEmission: true }
      });
      if (wantsNfce && tenant?.enableNfceEmission) {
        void enqueueNfceIssue(tenantId, sale.id).catch((err) =>
          console.error("[NFC-e] enqueue:", err?.message || err)
        );
      }
      return sale;
    });
  },

  async update(tenantId, saleId, userId, userType, payload) {
    return prisma.$transaction(async (tx) => {
      const currentSale = await assertSaleMutable(tx, tenantId, saleId);
      if (currentSale.status === SaleStatus.CANCELED) {
        const err = new Error("Nao e possivel editar venda cancelada.");
        err.statusCode = 409;
        throw err;
      }

      assertNoDuplicateVariationLines(payload.items);
      await assertCustomerBelongsToTenant(tx, tenantId, payload.customerId);

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
      const saleItems = buildAndValidateSaleLineItems(payload.items, variationMap);

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
        await applyStockExitForLine(tx, tenantId, item);
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
      const currentSale = await assertSaleMutable(tx, tenantId, saleId);
      if (currentSale.status === SaleStatus.CANCELED) {
        return currentSale;
      }

      await restoreSaleEffects(tx, tenantId, currentSale);

      return tx.sale.update({
        where: { id: currentSale.id, tenantId },
        data: { status: SaleStatus.CANCELED }
      });
    });
  }
};
