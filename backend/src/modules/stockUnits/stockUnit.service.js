import { StockUnitStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { syncVariationStock } from "../../shared/stockUnitSync.js";

function normalizeBarcode(raw) {
  return String(raw ?? "").trim();
}

export const stockUnitService = {
  async listByVariation(tenantId, productVariationId) {
    const variation = await prisma.productVariation.findFirst({
      where: { tenantId, id: productVariationId },
      include: { product: { select: { trackByUnit: true } } }
    });
    if (!variation) {
      const err = new Error("Variacao nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    if (!variation.product.trackByUnit) {
      const err = new Error("Este produto nao rastreia estoque por unidade (codigo de barras).");
      err.statusCode = 400;
      throw err;
    }
    return prisma.stockUnit.findMany({
      where: { tenantId, productVariationId },
      orderBy: { createdAt: "desc" }
    });
  },

  async create(tenantId, { productVariationId, barcode, notes }) {
    const bc = normalizeBarcode(barcode);
    if (bc.length < 2) {
      const err = new Error("Codigo de barras invalido.");
      err.statusCode = 400;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const variation = await tx.productVariation.findFirst({
        where: { tenantId, id: productVariationId },
        include: { product: true }
      });
      if (!variation) {
        const err = new Error("Variacao nao encontrada.");
        err.statusCode = 404;
        throw err;
      }
      if (!variation.product.trackByUnit) {
        const err = new Error("Ative 'rastrear por peca' no produto antes de cadastrar codigos.");
        err.statusCode = 400;
        throw err;
      }

      const unit = await tx.stockUnit.create({
        data: {
          tenantId,
          productVariationId,
          barcode: bc,
          notes: notes?.trim() || null,
          status: StockUnitStatus.AVAILABLE
        }
      });
      await syncVariationStock(tx, tenantId, productVariationId);
      return unit;
    });
  },

  async remove(tenantId, id) {
    return prisma.$transaction(async (tx) => {
      const unit = await tx.stockUnit.findFirst({
        where: { tenantId, id }
      });
      if (!unit) {
        const err = new Error("Unidade nao encontrada.");
        err.statusCode = 404;
        throw err;
      }
      if (unit.status !== StockUnitStatus.AVAILABLE) {
        const err = new Error("Nao e possivel excluir unidade ja vendida.");
        err.statusCode = 409;
        throw err;
      }
      const vid = unit.productVariationId;
      await tx.stockUnit.delete({ where: { id: unit.id } });
      await syncVariationStock(tx, tenantId, vid);
    });
  },

  /** Bip na venda: localiza unidade disponivel pelo codigo (escopo do tenant). */
  async resolveBarcode(tenantId, barcode) {
    const bc = normalizeBarcode(barcode);
    if (bc.length < 2) {
      const err = new Error("Codigo invalido.");
      err.statusCode = 400;
      throw err;
    }

    const unit = await prisma.stockUnit.findFirst({
      where: { tenantId, barcode: bc },
      include: {
        productVariation: {
          include: { product: { include: { category: true, brand: true } } }
        }
      }
    });

    if (!unit) return null;
    if (unit.status !== StockUnitStatus.AVAILABLE) {
      const err = new Error("Esta peca ja foi vendida.");
      err.statusCode = 409;
      throw err;
    }
    if (!unit.productVariation.product.trackByUnit) {
      const err = new Error("Produto sem rastreio por unidade.");
      err.statusCode = 400;
      throw err;
    }

    return {
      stockUnit: {
        id: unit.id,
        barcode: unit.barcode,
        notes: unit.notes,
        status: unit.status
      },
      productVariation: unit.productVariation
    };
  }
};
