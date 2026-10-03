import { parsePageQuery } from "../../shared/pagination.js";
import { auditLogService } from "./auditLog.service.js";

export const auditLogController = {
  async list(req, res, next) {
    try {
      const { take, skip } = parsePageQuery(req.query, { defaultTake: 50, maxTake: 200 });
      const action = req.query.action ? String(req.query.action).trim() : undefined;
      const userId = req.query.userId ? String(req.query.userId).trim() : undefined;
      const q = req.query.q ? String(req.query.q).trim() : undefined;
      const from = req.query.from ? String(req.query.from) : undefined;
      const to = req.query.to ? String(req.query.to) : undefined;

      const result = await auditLogService.list(req.tenantId, {
        take,
        skip,
        action,
        userId,
        q,
        from,
        to
      });
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
};
