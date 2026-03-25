import { invoiceService } from "./invoice.service.js";

export const invoiceController = {
  async connectionTest(_req, res, next) {
    try {
      const data = await invoiceService.connectionTest();
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async issue(req, res, next) {
    try {
      const invoice = await invoiceService.issueFromSale(req.tenantId, req.params.saleId);
      return res.status(201).json(invoice);
    } catch (error) {
      return next(error);
    }
  },

  async downloadPdf(req, res, next) {
    try {
      const { buf, filename } = await invoiceService.fetchNfcePdfBuffer(req.tenantId, req.params.saleId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      return res.send(buf);
    } catch (error) {
      return next(error);
    }
  }
};
