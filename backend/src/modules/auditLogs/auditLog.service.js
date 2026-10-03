import { prisma } from "../../config/prisma.js";

export const auditLogService = {
  async list(tenantId, { take = 50, skip = 0, action, userId, q, from, to } = {}) {
    const limit = Math.min(Math.max(Number(take) || 50, 1), 200);
    const offset = Math.max(Number(skip) || 0, 0);

    const where = { tenantId };
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (q) {
      where.OR = [
        { summary: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
        { action: { contains: q, mode: "insensitive" } }
      ];
    }
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) {
          // inclui o dia inteiro se for so data
          if (/^\d{4}-\d{2}-\d{2}$/.test(String(to).trim())) {
            d.setHours(23, 59, 59, 999);
          }
          where.createdAt.lte = d;
        }
      }
      if (!Object.keys(where.createdAt).length) delete where.createdAt;
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, type: true } }
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    return { items, total, take: limit, skip: offset };
  }
};
