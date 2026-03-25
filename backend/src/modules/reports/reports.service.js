import { prisma } from "../../config/prisma.js";
import { productService } from "../products/product.service.js";

function parseRange(fromStr, toStr) {
  if (!fromStr || !toStr) {
    const err = new Error("Informe from e to no formato YYYY-MM-DD.");
    err.statusCode = 400;
    throw err;
  }
  const start = new Date(`${fromStr}T00:00:00`);
  const end = new Date(`${toStr}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const err = new Error("Datas invalidas.");
    err.statusCode = 400;
    throw err;
  }
  if (start > end) {
    const err = new Error("A data inicial nao pode ser maior que a final.");
    err.statusCode = 400;
    throw err;
  }
  return { start, end };
}

export const reportsService = {
  async salesByPeriod(tenantId, fromStr, toStr) {
    const { start, end } = parseRange(fromStr, toStr);
    const sales = await prisma.sale.findMany({
      where: {
        tenantId,
        status: "PAID",
        occurredAt: { gte: start, lte: end }
      },
      select: { totalValue: true, occurredAt: true }
    });

    const totalAmount = sales.reduce((acc, s) => acc + Number(s.totalValue), 0);
    const byDayMap = new Map();
    for (const s of sales) {
      const d = new Date(s.occurredAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const cur = byDayMap.get(key) || { date: key, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(s.totalValue);
      byDayMap.set(key, cur);
    }
    const byDay = Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      from: fromStr,
      to: toStr,
      saleCount: sales.length,
      totalAmount,
      byDay
    };
  },

  async lowStock(tenantId) {
    const items = await productService.lowStock(tenantId);
    return { count: items.length, items };
  }
};
