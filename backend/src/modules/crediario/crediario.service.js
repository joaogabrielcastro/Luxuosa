import { CreditSaleStatus, PaymentMethod, StockMovementType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { pagedResult } from "../../shared/pagination.js";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

async function restoreCreditSaleEffects(tx, tenantId, creditSale) {
  for (const item of creditSale.items) {
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

  const totalValue = toNumber(creditSale.totalValue);
  await tx.customer.updateMany({
    where: { tenantId, id: creditSale.customerId },
    data: {
      totalPurchases: { decrement: totalValue }
    }
  });
}

export const crediarioService = {
  async list(tenantId, { skip = 0, take = 50, status, q } = {}) {
    const where = { tenantId };
    if (status && Object.values(CreditSaleStatus).includes(status)) {
      where.status = status;
    }
    if (q && String(q).trim()) {
      const raw = String(q).trim();
      const digits = raw.replace(/\D/g, "");
      where.customer = {
        OR: [
          { name: { contains: raw, mode: "insensitive" } },
          ...(digits.length ? [{ cpfCnpj: { contains: digits } }] : [])
        ]
      };
    }

    const [items, total] = await Promise.all([
      prisma.creditSale.findMany({
        where,
        skip,
        take,
        orderBy: { occurredAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, cpfCnpj: true, phone: true } },
          user: { select: { id: true, name: true } },
          _count: { select: { payments: true } }
        }
      }),
      prisma.creditSale.count({ where })
    ]);

    const enriched = items.map((row) => {
      const totalValue = toNumber(row.totalValue);
      const paidTotal = toNumber(row.paidTotal);
      return {
        ...row,
        remaining: Math.max(totalValue - paidTotal, 0)
      };
    });

    return pagedResult(enriched, { total, take, skip });
  },

  async getById(tenantId, id) {
    const sale = await prisma.creditSale.findFirst({
      where: { tenantId, id },
      include: {
        customer: true,
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            productVariation: {
              include: { product: { select: { id: true, name: true, sku: true } } }
            }
          }
        },
        payments: { orderBy: { paidAt: "desc" } }
      }
    });
    if (!sale) return null;
    const totalValue = toNumber(sale.totalValue);
    const paidTotal = toNumber(sale.paidTotal);
    return {
      ...sale,
      remaining: Math.max(totalValue - paidTotal, 0)
    };
  },

  async create(tenantId, userId, userType, payload) {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { tenantId, id: payload.customerId }
      });
      if (!customer) {
        const err = new Error("Cliente nao encontrado.");
        err.statusCode = 404;
        throw err;
      }

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
      const percentDiscountValue = (grossTotal * discountPercent) / 100;
      const totalValue = Math.max(grossTotal - discountValue - percentDiscountValue, 0);

      const creditSale = await tx.creditSale.create({
        data: {
          tenantId,
          customerId: payload.customerId,
          userId,
          totalValue,
          discountValue,
          discountPercent,
          paidTotal: 0,
          status: CreditSaleStatus.OPEN,
          notes: payload.notes?.trim() || null,
          items: {
            create: saleItems.map((item) => ({
              tenantId,
              productVariationId: item.productVariationId,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }))
          }
        },
        include: {
          customer: { select: { id: true, name: true, cpfCnpj: true } },
          items: true
        }
      });

      for (const item of saleItems) {
        const dec = await tx.productVariation.updateMany({
          where: { tenantId, id: item.productVariationId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        });
        if (dec.count === 0) {
          const err = new Error(`Estoque insuficiente para variacao ${item.productVariationId}.`);
          err.statusCode = 400;
          throw err;
        }
        await tx.stockMovement.create({
          data: {
            tenantId,
            productVariationId: item.productVariationId,
            type: StockMovementType.EXIT,
            quantity: item.quantity
          }
        });
      }

      await tx.customer.updateMany({
        where: { tenantId, id: payload.customerId },
        data: {
          totalPurchases: { increment: totalValue },
          lastPurchaseAt: new Date()
        }
      });

      return creditSale;
    });
  },

  async addPayment(tenantId, creditSaleId, payload) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.creditSale.findFirst({
        where: { tenantId, id: creditSaleId }
      });
      if (!sale) {
        const err = new Error("Venda a prazo nao encontrada.");
        err.statusCode = 404;
        throw err;
      }
      if (sale.status !== CreditSaleStatus.OPEN) {
        const err = new Error("So e possivel registrar pagamento em conta em aberto.");
        err.statusCode = 409;
        throw err;
      }

      const totalValue = toNumber(sale.totalValue);
      const paidTotal = toNumber(sale.paidTotal);
      const remaining = Math.max(totalValue - paidTotal, 0);
      const amount = toNumber(payload.amount);
      if (amount <= 0) {
        const err = new Error("Valor do pagamento deve ser maior que zero.");
        err.statusCode = 400;
        throw err;
      }
      if (amount > remaining + 0.0001) {
        const err = new Error("Valor excede o saldo em aberto.");
        err.statusCode = 400;
        throw err;
      }

      const method = normalizePaymentMethod(payload.paymentMethod || "dinheiro");
      if (!Object.values(PaymentMethod).includes(method)) {
        const err = new Error("Forma de pagamento invalida.");
        err.statusCode = 400;
        throw err;
      }

      const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();
      if (Number.isNaN(paidAt.getTime())) {
        const err = new Error("Data do pagamento invalida.");
        err.statusCode = 400;
        throw err;
      }

      await tx.creditPayment.create({
        data: {
          tenantId,
          creditSaleId,
          amount,
          paymentMethod: method,
          paidAt,
          note: payload.note?.trim() || null
        }
      });

      const newPaid = paidTotal + amount;
      const nextStatus = newPaid >= totalValue - 0.0001 ? CreditSaleStatus.PAID : CreditSaleStatus.OPEN;

      return tx.creditSale.update({
        where: { id: creditSaleId },
        data: {
          paidTotal: newPaid,
          status: nextStatus
        },
        include: {
          customer: { select: { id: true, name: true, cpfCnpj: true } },
          payments: { orderBy: { paidAt: "desc" } }
        }
      });
    });
  },

  async cancel(tenantId, creditSaleId) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.creditSale.findFirst({
        where: { tenantId, id: creditSaleId },
        include: { items: true }
      });
      if (!sale) {
        const err = new Error("Venda a prazo nao encontrada.");
        err.statusCode = 404;
        throw err;
      }
      if (sale.status === CreditSaleStatus.CANCELED) {
        return sale;
      }
      if (sale.status !== CreditSaleStatus.OPEN) {
        const err = new Error("So e possivel cancelar conta em aberto.");
        err.statusCode = 409;
        throw err;
      }
      if (toNumber(sale.paidTotal) > 0.0001) {
        const err = new Error("Nao e possivel cancelar apos recebimento. Estorne os pagamentos manualmente no suporte.");
        err.statusCode = 409;
        throw err;
      }

      await restoreCreditSaleEffects(tx, tenantId, sale);

      return tx.creditSale.update({
        where: { id: creditSaleId },
        data: { status: CreditSaleStatus.CANCELED }
      });
    });
  }
};
