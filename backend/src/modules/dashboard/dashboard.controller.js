import { dashboardService } from "./dashboard.service.js";

export const dashboardController = {
  async admin(req, res, next) {
    try {
      const compact = String(req.query.compact || "").toLowerCase();
      const includeHeavy = !(compact === "1" || compact === "true" || compact === "yes");
      const data = await dashboardService.admin(req.tenantId, { includeHeavy });
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  }
};
