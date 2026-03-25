import { z } from "zod";
import { reportsService } from "./reports.service.js";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const salesQuerySchema = z.object({
  from: dateStr,
  to: dateStr
});

export const reportsController = {
  async sales(req, res, next) {
    try {
      const q = salesQuerySchema.parse(req.query);
      const data = await reportsService.salesByPeriod(req.tenantId, q.from, q.to);
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async lowStock(req, res, next) {
    try {
      const data = await reportsService.lowStock(req.tenantId);
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  }
};
