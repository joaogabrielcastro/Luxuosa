/**
 * Matching de itens da NF-e contra o catalogo do tenant.
 * Ordem: EAN → Product.sku, cProd → Product.sku, cProd → ProductSupplierCode.
 */

async function findProductBySku(tx, tenantId, sku) {
  if (!sku) return null;
  const normalized = String(sku).trim();
  if (!normalized) return null;
  return tx.product.findFirst({
    where: { tenantId, sku: normalized },
    include: { variations: true, category: true, brand: true }
  });
}

async function findProductBySupplierCode(tx, tenantId, supplierId, code) {
  if (!supplierId || !code) return null;
  const link = await tx.productSupplierCode.findFirst({
    where: { tenantId, supplierId, code },
    include: {
      product: { include: { variations: true, category: true, brand: true } }
    }
  });
  return link?.product || null;
}

export async function matchProductForItem(tx, tenantId, item, supplier) {
  if (item.ean) {
    const byEan = await findProductBySku(tx, tenantId, item.ean);
    if (byEan) return { product: byEan, matchBy: "EAN" };
  }
  if (item.supplierCode) {
    const bySku = await findProductBySku(tx, tenantId, item.supplierCode);
    if (bySku) return { product: bySku, matchBy: "SKU" };
  }
  if (supplier?.id && item.supplierCode) {
    const byCode = await findProductBySupplierCode(tx, tenantId, supplier.id, item.supplierCode);
    if (byCode) return { product: byCode, matchBy: "SUPPLIER_CODE" };
  }
  return { product: null, matchBy: null };
}
