import { dashboardService } from "./dashboard.service.js";

export const dashboardController = {
  async admin(req, res, next) {
    try {
      const data = await dashboardService.admin(req.tenantId);
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  }
};
