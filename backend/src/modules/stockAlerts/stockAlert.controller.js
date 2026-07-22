import { z } from "zod";
import { parsePageQuery } from "../../shared/pagination.js";
import { stockAlertService } from "./stockAlert.service.js";

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  email: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional(),
  phone: z.string().max(40).optional().nullable(),
  minSeverity: z.enum(["low", "critical"]).optional(),
  cooldownMin: z.coerce.number().int().nonnegative().optional()
});

export const stockAlertController = {
  async getSettings(req, res, next) {
    try {
      const data = await stockAlertService.getSettings(req.tenantId);
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async updateSettings(req, res, next) {
    try {
      const payload = settingsSchema.parse(req.body || {});
      if (payload.email === "") payload.email = null;
      const data = await stockAlertService.updateSettings(req.tenantId, payload);
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async run(req, res, next) {
    try {
      const data = await stockAlertService.runCheck(req.tenantId);
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async listLogs(req, res, next) {
    try {
      const { take, skip } = parsePageQuery(req.query, { defaultTake: 50, maxTake: 200 });
      const data = await stockAlertService.listLogs(req.tenantId, { take, skip });
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  }
};
