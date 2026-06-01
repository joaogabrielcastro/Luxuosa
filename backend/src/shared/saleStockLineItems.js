import { StockMovementType } from "@prisma/client";

/**
 * Valida payload de itens e monta linhas de venda.
 * @param {Array} payloadItems
 * @param {Map} variationMap - id -> ProductVariation & { product }
 */
export function buildAndValidateSaleLineItems(payloadItems, variationMap) {
  const saleItems = [];
  const seenVariation = new Set();

  for (const raw of payloadItems) {
    if (seenVariation.has(raw.productVariationId)) {
      const err = new Error(
        "Nao e permitido repetir a mesma variacao na venda. Ajuste a quantidade na linha existente."
      );
      err.statusCode = 400;
      throw err;
    }
    seenVariation.add(raw.productVariationId);
    const variation = variationMap.get(raw.productVariationId);
    if (!variation) {
      const err = new Error("Variacao invalida.");
      err.statusCode = 400;
      throw err;
    }

    const qty = Number(raw.quantity);
    const unitPrice = Number(raw.unitPrice);

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

  return saleItems;
}

export async function applyStockExitForLine(tx, tenantId, item) {
  const dec = await tx.productVariation.updateMany({
    where: { tenantId, id: item.productVariationId, stock: { gte: item.quantity } },
    data: { stock: { decrement: item.quantity } }
  });
  if (dec.count === 0) {
    const err = new Error(`Estoque insuficiente para variacao ${item.productVariationId}.`);
    err.statusCode = 400;
    throw err;
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
  await tx.productVariation.updateMany({
    where: { tenantId, id: item.productVariationId },
    data: { stock: { increment: item.quantity } }
  });

  await tx.stockMovement.create({
    data: {
      tenantId,
      productVariationId: item.productVariationId,
      type: StockMovementType.ENTRY,
      quantity: item.quantity
    }
  });
}
