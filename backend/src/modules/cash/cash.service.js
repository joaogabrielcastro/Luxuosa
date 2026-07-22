import { prisma } from "../../config/prisma.js";
import { pagedResult } from "../../shared/pagination.js";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function aggregatePaidSales(tenantId, from, to = new Date()) {
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      status: "PAID",
      occurredAt: { gte: from, lte: to }
    },
    select: { paymentMethod: true, totalValue: true }
  });

  const totalsByMethod = {};
  let totalAmount = 0;
  for (const sale of sales) {
    const amount = toNumber(sale.totalValue);
    totalAmount += amount;
    totalsByMethod[sale.paymentMethod] = toNumber(totalsByMethod[sale.paymentMethod]) + amount;
  }

  return {
    saleCount: sales.length,
    totalAmount,
    totalsByMethod,
    expectedCash: toNumber(totalsByMethod.CASH)
  };
}

function serializeSession(session, preview = null) {
  if (!session && !preview) return null;
  const base = session
    ? {
        id: session.id,
        tenantId: session.tenantId,
        status: session.status,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        openingFloat: toNumber(session.openingFloat),
        expectedCash: session.expectedCash != null ? toNumber(session.expectedCash) : null,
        countedCash: session.countedCash != null ? toNumber(session.countedCash) : null,
        differenceCash: session.differenceCash != null ? toNumber(session.differenceCash) : null,
        totalsByMethod: session.totalsByMethod || null,
        saleCount: session.saleCount,
        totalAmount: session.totalAmount != null ? toNumber(session.totalAmount) : null,
        notes: session.notes,
        openedByUserId: session.openedByUserId,
        closedByUserId: session.closedByUserId,
        openedBy: session.openedBy || undefined,
        closedBy: session.closedBy || undefined,
        createdAt: session.createdAt
      }
    : null;

  if (!preview) return base;
  return {
    session: base,
    preview: {
      from: preview.from,
      to: preview.to,
      saleCount: preview.saleCount,
      totalAmount: preview.totalAmount,
      totalsByMethod: preview.totalsByMethod,
      expectedCash: preview.expectedCash,
      expectedDrawer: toNumber(base?.openingFloat) + preview.expectedCash
    }
  };
}

export const cashService = {
  async getCurrent(tenantId) {
    const session = await prisma.cashSession.findFirst({
      where: { tenantId, status: "OPEN" },
      include: {
        openedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: { openedAt: "desc" }
    });
    const from = session?.openedAt || startOfToday();
    const preview = await aggregatePaidSales(tenantId, from);
    return serializeSession(session, { ...preview, from, to: new Date() });
  },

  async preview(tenantId) {
    const session = await prisma.cashSession.findFirst({
      where: { tenantId, status: "OPEN" },
      orderBy: { openedAt: "desc" }
    });
    const from = session?.openedAt || startOfToday();
    const preview = await aggregatePaidSales(tenantId, from);
    return {
      sessionId: session?.id || null,
      status: session?.status || null,
      openingFloat: session ? toNumber(session.openingFloat) : 0,
      from,
      to: new Date(),
      ...preview,
      expectedDrawer: (session ? toNumber(session.openingFloat) : 0) + preview.expectedCash
    };
  },

  async open(tenantId, userId, { openingFloat = 0 } = {}) {
    const existing = await prisma.cashSession.findFirst({
      where: { tenantId, status: "OPEN" }
    });
    if (existing) {
      const err = new Error("Ja existe um caixa aberto. Feche o atual antes de abrir outro.");
      err.statusCode = 409;
      err.code = "CASH_SESSION_ALREADY_OPEN";
      throw err;
    }

    const float = Math.max(0, toNumber(openingFloat));
    const created = await prisma.cashSession.create({
      data: {
        tenantId,
        openedByUserId: userId,
        openingFloat: float,
        status: "OPEN"
      },
      include: {
        openedBy: { select: { id: true, name: true, email: true } }
      }
    });
    return serializeSession(created);
  },

  async close(tenantId, userId, sessionId, { countedCash, notes } = {}) {
    const session = await prisma.cashSession.findFirst({
      where: { id: sessionId, tenantId }
    });
    if (!session) {
      const err = new Error("Sessao de caixa nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    if (session.status !== "OPEN") {
      const err = new Error("Esta sessao de caixa ja esta fechada.");
      err.statusCode = 409;
      err.code = "CASH_SESSION_ALREADY_CLOSED";
      throw err;
    }

    const now = new Date();
    const totals = await aggregatePaidSales(tenantId, session.openedAt, now);
    const counted = toNumber(countedCash);
    const expectedCash = totals.expectedCash;
    const differenceCash = counted - expectedCash;

    const updated = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedAt: now,
        closedByUserId: userId,
        expectedCash,
        countedCash: counted,
        differenceCash,
        totalsByMethod: totals.totalsByMethod,
        saleCount: totals.saleCount,
        totalAmount: totals.totalAmount,
        notes: notes != null ? String(notes).slice(0, 2000) : null
      },
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true, email: true } }
      }
    });
    return serializeSession(updated);
  },

  async list(tenantId, { take = 50, skip = 0 } = {}) {
    const where = { tenantId };
    const [items, total] = await Promise.all([
      prisma.cashSession.findMany({
        where,
        orderBy: { openedAt: "desc" },
        take,
        skip,
        include: {
          openedBy: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } }
        }
      }),
      prisma.cashSession.count({ where })
    ]);
    return pagedResult(
      items.map((row) => serializeSession(row)),
      { total, take, skip }
    );
  }
};
