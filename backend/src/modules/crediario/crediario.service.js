import { CreditSaleStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { pagedResult } from "../../shared/pagination.js";
import { normalizePaymentMethod, assertNoDuplicateVariationLines } from "../../shared/salePayload.js";
import {
  applyStockExitForLine,
  buildAndValidateSaleLineItems,
  restoreStockForLine
} from "../../shared/saleStockLineItems.js";
import { AUDIT_ACTIONS, recordAuditInTx } from "../../shared/auditLog.js";

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

async function restoreCreditSaleEffects(tx, tenantId, creditSale) {
  for (const item of creditSale.items) {
    await restoreStockForLine(tx, tenantId, item);
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
  async getConfig(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        creditEventMode: true,
        creditEventOnly: true,
        creditEventName: true,
        creditEventDueDate: true,
        creditEventClosedAt: true,
        creditDefaultLimit: true
      }
    });
    if (!tenant) {
      const err = new Error("Loja nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    return {
      eventMode: tenant.creditEventMode,
      eventOnly: tenant.creditEventOnly,
      eventName: tenant.creditEventName,
      dueDate: tenant.creditEventDueDate,
      closedAt: tenant.creditEventClosedAt,
      defaultCreditLimit: tenant.creditDefaultLimit == null ? null : toNumber(tenant.creditDefaultLimit)
    };
  },

  async updateConfig(tenantId, userId, payload) {
    const data = {};
    if (payload.eventMode !== undefined) data.creditEventMode = Boolean(payload.eventMode);
    if (payload.eventOnly !== undefined) data.creditEventOnly = Boolean(payload.eventOnly);
    if (payload.eventName !== undefined) data.creditEventName = payload.eventName || null;
    if (payload.defaultCreditLimit !== undefined) data.creditDefaultLimit = payload.defaultCreditLimit;
    if (payload.dueDate !== undefined) {
      const due = payload.dueDate ? new Date(`${payload.dueDate}T12:00:00.000Z`) : null;
      if (due && Number.isNaN(due.getTime())) {
        const err = new Error("Data de vencimento invalida.");
        err.statusCode = 400;
        throw err;
      }
      data.creditEventDueDate = due;
    }
    if (payload.eventName || payload.eventMode === true) data.creditEventClosedAt = null;
    const updated = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({ where: { id: tenantId }, data });
      await recordAuditInTx(tx, {
        tenantId,
        userId,
        action: AUDIT_ACTIONS.CREDIT_EVENT_CONFIGURED,
        entityType: "Tenant",
        entityId: tenantId,
        summary: `Configuracao do crediario atualizada${tenant.creditEventName ? `: ${tenant.creditEventName}` : ""}`,
        meta: { eventMode: tenant.creditEventMode, eventName: tenant.creditEventName }
      });
      return tenant;
    });
    return {
      eventMode: updated.creditEventMode,
      eventOnly: updated.creditEventOnly,
      eventName: updated.creditEventName,
      dueDate: updated.creditEventDueDate,
      closedAt: updated.creditEventClosedAt,
      defaultCreditLimit: updated.creditDefaultLimit == null ? null : toNumber(updated.creditDefaultLimit)
    };
  },

  async closeEvent(tenantId, userId) {
    const config = await this.getConfig(tenantId);
    if (!config.eventMode || !config.eventName) {
      const err = new Error("Nenhum evento de crediario esta ativo.");
      err.statusCode = 409;
      throw err;
    }
    const accounts = await this.accounts(tenantId, { eventName: config.eventName });
    const closedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { creditEventMode: false, creditEventClosedAt: closedAt }
      });
      await recordAuditInTx(tx, {
        tenantId,
        userId,
        action: AUDIT_ACTIONS.CREDIT_EVENT_CLOSED,
        entityType: "Tenant",
        entityId: tenantId,
        summary: `Evento de crediario fechado: ${config.eventName}`,
        meta: { accountCount: accounts.items.length, openBalance: accounts.openBalance }
      });
    });
    return { eventName: config.eventName, closedAt, ...accounts };
  },

  async accounts(tenantId, { eventName, q } = {}) {
    const where = { tenantId, status: CreditSaleStatus.OPEN };
    if (eventName) where.eventName = eventName;
    const sales = await prisma.creditSale.findMany({
      where,
      orderBy: { occurredAt: "asc" },
      include: { customer: true, _count: { select: { items: true } } }
    });
    const grouped = new Map();
    for (const sale of sales) {
      const current = grouped.get(sale.customerId) || {
        customer: sale.customer,
        saleCount: 0,
        itemCount: 0,
        totalValue: 0,
        paidTotal: 0,
        remaining: 0,
        firstPurchaseAt: sale.occurredAt,
        lastPurchaseAt: sale.occurredAt,
        dueDate: sale.dueDate || null
      };
      current.saleCount += 1;
      current.itemCount += sale._count.items;
      current.totalValue += toNumber(sale.totalValue);
      current.paidTotal += toNumber(sale.paidTotal);
      current.remaining += Math.max(toNumber(sale.totalValue) - toNumber(sale.paidTotal), 0);
      current.lastPurchaseAt = sale.occurredAt;
      if (sale.dueDate) current.dueDate = sale.dueDate;
      grouped.set(sale.customerId, current);
    }
    let items = [...grouped.values()].sort((a, b) => b.remaining - a.remaining);
    if (q) {
      const text = q.toLowerCase();
      const digits = q.replace(/\D/g, "");
      items = items.filter(({ customer }) =>
        customer.name.toLowerCase().includes(text) ||
        (digits && [customer.cpfCnpj, customer.phone, customer.eventCode].some((v) => String(v || "").includes(digits))) ||
        String(customer.eventCode || "").toLowerCase().includes(text)
      );
    }
    return {
      eventName: eventName || null,
      items,
      openBalance: items.reduce((sum, item) => sum + item.remaining, 0)
    };
  },

  async customerStatement(tenantId, customerId, { eventName } = {}) {
    const customer = await prisma.customer.findFirst({ where: { tenantId, id: customerId } });
    if (!customer) return null;
    const where = { tenantId, customerId, status: { not: CreditSaleStatus.CANCELED } };
    if (eventName) where.eventName = eventName;
    const sales = await prisma.creditSale.findMany({
      where,
      orderBy: { occurredAt: "asc" },
      include: {
        user: { select: { id: true, name: true } },
        items: { include: { productVariation: { include: { product: true } } } },
        payments: { orderBy: { paidAt: "asc" } }
      }
    });
    const totalValue = sales.reduce((sum, sale) => sum + toNumber(sale.totalValue), 0);
    const paidTotal = sales.reduce((sum, sale) => sum + toNumber(sale.paidTotal), 0);
    return { customer, eventName: eventName || null, sales, totalValue, paidTotal, remaining: Math.max(totalValue - paidTotal, 0) };
  },

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

      assertNoDuplicateVariationLines(payload.items);

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
      const percentDiscountValue = (grossTotal * discountPercent) / 100;
      const totalValue = Math.max(grossTotal - discountValue - percentDiscountValue, 0);

      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { creditEventMode: true, creditEventName: true, creditEventDueDate: true, creditDefaultLimit: true }
      });
      const limit = customer.creditLimit == null ? toNumber(tenant?.creditDefaultLimit, 0) : toNumber(customer.creditLimit, 0);
      const open = await tx.creditSale.aggregate({
        where: { tenantId, customerId: payload.customerId, status: CreditSaleStatus.OPEN },
        _sum: { totalValue: true, paidTotal: true }
      });
      const currentBalance = Math.max(toNumber(open._sum.totalValue) - toNumber(open._sum.paidTotal), 0);
      if (limit > 0 && currentBalance + totalValue > limit + 0.0001) {
        const mayOverride = userType === "ADMIN" && payload.overrideCreditLimit === true;
        if (!mayOverride) {
          const err = new Error(`Limite de crediario excedido. Saldo atual R$ ${currentBalance.toFixed(2)}, limite R$ ${limit.toFixed(2)}.`);
          err.statusCode = 409;
          err.code = "CREDIT_LIMIT_EXCEEDED";
          err.details = { currentBalance, saleTotal: totalValue, limit };
          throw err;
        }
      }

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
          eventName: tenant?.creditEventMode ? tenant.creditEventName : null,
          dueDate: tenant?.creditEventMode ? tenant.creditEventDueDate : null,
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
        await applyStockExitForLine(tx, tenantId, item);
      }

      await tx.customer.updateMany({
        where: { tenantId, id: payload.customerId },
        data: {
          totalPurchases: { increment: totalValue },
          lastPurchaseAt: new Date()
        }
      });

      await recordAuditInTx(tx, {
        tenantId,
        userId,
        action: AUDIT_ACTIONS.CREDIT_SALE_CREATED,
        entityType: "CreditSale",
        entityId: creditSale.id,
        summary: `Venda a prazo registrada para ${customer.name}`,
        meta: { customerId: customer.id, totalValue, eventName: tenant?.creditEventName || null }
      });

      return creditSale;
    });
  },

  async addPayment(tenantId, userId, creditSaleId, payload) {
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

      await recordAuditInTx(tx, {
        tenantId,
        userId,
        action: AUDIT_ACTIONS.CREDIT_PAYMENT_RECEIVED,
        entityType: "CreditSale",
        entityId: creditSaleId,
        summary: `Recebimento de crediario: R$ ${amount.toFixed(2)}`,
        meta: { amount, paymentMethod: method }
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

  async cancel(tenantId, userId, creditSaleId) {
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

      await recordAuditInTx(tx, {
        tenantId,
        userId,
        action: AUDIT_ACTIONS.CREDIT_SALE_CANCELED,
        entityType: "CreditSale",
        entityId: creditSaleId,
        summary: "Venda a prazo cancelada",
        meta: { customerId: sale.customerId, totalValue: toNumber(sale.totalValue) }
      });

      return tx.creditSale.update({
        where: { id: creditSaleId },
        data: { status: CreditSaleStatus.CANCELED }
      });
    });
  },

  async remove(tenantId, userId, creditSaleId) {
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
      if (sale.status === CreditSaleStatus.OPEN && toNumber(sale.paidTotal) > 0.0001) {
        const err = new Error(
          "Nao e possivel excluir conta com recebimento em aberto. Quite o saldo antes ou cancele apenas vendas sem pagamento."
        );
        err.statusCode = 409;
        throw err;
      }

      if (sale.status === CreditSaleStatus.OPEN) {
        await restoreCreditSaleEffects(tx, tenantId, sale);
      } else if (sale.status === CreditSaleStatus.PAID) {
        await tx.customer.updateMany({
          where: { tenantId, id: sale.customerId },
          data: { totalPurchases: { decrement: toNumber(sale.totalValue) } }
        });
      }

      await tx.creditSale.delete({ where: { id: creditSaleId } });
      await recordAuditInTx(tx, {
        tenantId,
        userId,
        action: AUDIT_ACTIONS.CREDIT_SALE_DELETED,
        entityType: "CreditSale",
        entityId: creditSaleId,
        summary: "Registro de crediario excluido",
        meta: { customerId: sale.customerId, status: sale.status }
      });
      return { ok: true };
    });
  }
};
