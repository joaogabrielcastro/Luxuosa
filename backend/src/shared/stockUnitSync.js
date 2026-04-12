import { StockUnitStatus } from "@prisma/client";

/** Atualiza ProductVariation.stock com a contagem de unidades AVAILABLE. */
export async function syncVariationStock(tx, tenantId, productVariationId) {
  const count = await tx.stockUnit.count({
    where: { tenantId, productVariationId, status: StockUnitStatus.AVAILABLE }
  });
  await tx.productVariation.updateMany({
    where: { tenantId, id: productVariationId },
    data: { stock: count }
  });
}
