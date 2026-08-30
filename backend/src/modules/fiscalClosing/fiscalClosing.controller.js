import { fiscalClosingService } from "./fiscalClosing.service.js";

export const fiscalClosingController = {
  async summary(req, res, next) {
    try {
      const year = req.query.year ?? req.query.ano;
      const month = req.query.month ?? req.query.mes;
      const data = await fiscalClosingService.getSummary(req.tenantId, year, month);
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async exportZip(req, res, next) {
    try {
      const year = req.query.year ?? req.query.ano;
      const month = req.query.month ?? req.query.mes;
      const { buf, filename } = await fiscalClosingService.buildExportZip(req.tenantId, year, month);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buf);
    } catch (error) {
      return next(error);
    }
  }
};
