import { StockMovementType, StockUnitStatus } from "@prisma/client";
import { syncVariationStock } from "./stockUnitSync.js";

/**
 * Valida payload de itens e monta linhas com stockUnitId quando aplicavel.
 * @param {Array} payloadItems
 * @param {Map} variationMap - id -> ProductVariation & { product }
 */
export function buildAndValidateSaleLineItems(payloadItems, variationMap) {
  const stockUnitIdsSeen = new Set();
  const saleItems = [];

  for (const raw of payloadItems) {
    const variation = variationMap.get(raw.productVariationId);
    if (!variation) {
      const err = new Error("Variacao invalida.");
      err.statusCode = 400;
      throw err;
    }

    const track = variation.product.trackByUnit;
    const qty = Number(raw.quantity);
    const unitPrice = Number(raw.unitPrice);
    const stockUnitId = raw.stockUnitId ? String(raw.stockUnitId) : null;

    if (track) {
      if (qty !== 1) {
        const err = new Error("Produto com rastreio por peca exige quantidade 1 por linha.");
        err.statusCode = 400;
        throw err;
      }
      if (!stockUnitId) {
        const err = new Error("Informe a unidade (codigo de barras) da peca para este produto.");
        err.statusCode = 400;
        throw err;
      }
      if (stockUnitIdsSeen.has(stockUnitId)) {
        const err = new Error("Codigo de barras duplicado na venda.");
        err.statusCode = 400;
        throw err;
      }
      stockUnitIdsSeen.add(stockUnitId);
      if (variation.stock < 1) {
        const err = new Error(`Estoque insuficiente para variacao ${raw.productVariationId}.`);
        err.statusCode = 400;
        throw err;
      }
      saleItems.push({
        productVariationId: variation.id,
        quantity: 1,
        unitPrice,
        stockUnitId
      });
    } else {
      if (stockUnitId) {
        const err = new Error("Este produto nao usa codigo de unidade na venda.");
        err.statusCode = 400;
        throw err;
      }
      if (variation.stock < qty) {
        const err = new Error(`Estoque insuficiente para variacao ${raw.productVariationId}.`);
        err.statusCode = 400;
        throw err;
      }
      saleItems.push({
        productVariationId: variation.id,
        quantity: qty,
        unitPrice
      });
    }
  }

  return saleItems;
}

export async function assertStockUnitsAvailable(tx, tenantId, saleItems) {
  for (const item of saleItems) {
    if (!item.stockUnitId) continue;
    const u = await tx.stockUnit.findFirst({
      where: {
        tenantId,
        id: item.stockUnitId,
        productVariationId: item.productVariationId,
        status: StockUnitStatus.AVAILABLE
      }
    });
    if (!u) {
      const err = new Error("Unidade (codigo de barras) invalida ou ja vendida.");
      err.statusCode = 400;
      throw err;
    }
  }
}

export async function applyStockExitForLine(tx, tenantId, item) {
  if (item.stockUnitId) {
    const dec = await tx.stockUnit.updateMany({
      where: {
        tenantId,
        id: item.stockUnitId,
        productVariationId: item.productVariationId,
        status: StockUnitStatus.AVAILABLE
      },
      data: { status: StockUnitStatus.SOLD }
    });
    if (dec.count === 0) {
      const err = new Error("Unidade (codigo de barras) invalida ou ja vendida.");
      err.statusCode = 400;
      throw err;
    }
    await syncVariationStock(tx, tenantId, item.productVariationId);
  } else {
    const dec = await tx.productVariation.updateMany({
      where: { tenantId, id: item.productVariationId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } }
    });
    if (dec.count === 0) {
      const err = new Error(`Estoque insuficiente para variacao ${item.productVariationId}.`);
      err.statusCode = 400;
      throw err;
    }
  }

  await tx.stockMovement.create({
    data: {
      tenantId,
      productVariationId: item.productVariationId,
      type: StockMovementType.EXIT,
      quantity: item.quantity
    }
  });
}

export async function restoreStockForLine(tx, tenantId, item) {
  if (item.stockUnitId) {
    await tx.stockUnit.updateMany({
      where: { tenantId, id: item.stockUnitId, status: StockUnitStatus.SOLD },
      data: { status: StockUnitStatus.AVAILABLE }
    });
    await syncVariationStock(tx, tenantId, item.productVariationId);
  } else {
    await tx.productVariation.updateMany({
      where: { tenantId, id: item.productVariationId },
      data: { stock: { increment: item.quantity } }
    });
  }

  await tx.stockMovement.create({
    data: {
      tenantId,
      productVariationId: item.productVariationId,
      type: StockMovementType.ENTRY,
      quantity: item.quantity
    }
  });
}
