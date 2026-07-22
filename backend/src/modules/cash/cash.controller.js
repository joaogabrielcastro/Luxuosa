import { z } from "zod";
import { parsePageQuery } from "../../shared/pagination.js";
import { cashService } from "./cash.service.js";

const openSchema = z.object({
  openingFloat: z.coerce.number().nonnegative().optional().default(0)
});

const closeSchema = z.object({
  countedCash: z.coerce.number().nonnegative(),
  notes: z.string().max(2000).optional().nullable()
});

export const cashController = {
  async current(req, res, next) {
    try {
      const data = await cashService.getCurrent(req.tenantId);
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async preview(req, res, next) {
    try {
      const data = await cashService.preview(req.tenantId);
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async list(req, res, next) {
    try {
      const { take, skip } = parsePageQuery(req.query, { defaultTake: 50, maxTake: 200 });
      const data = await cashService.list(req.tenantId, { take, skip });
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async open(req, res, next) {
    try {
      const payload = openSchema.parse(req.body || {});
      const created = await cashService.open(req.tenantId, req.user.id, payload);
      return res.status(201).json(created);
    } catch (error) {
      return next(error);
    }
  },

  async close(req, res, next) {
    try {
      const payload = closeSchema.parse(req.body || {});
      const closed = await cashService.close(req.tenantId, req.user.id, req.params.id, payload);
      return res.json(closed);
    } catch (error) {
      return next(error);
    }
  }
};
