import { JOB_STATUS_LABELS, PAYMENT_LABELS, SALE_STATUS_LABELS } from "./sales.constants.js";

export function variationsForCategoryAndBrand(variations, categoryId, brandId) {
  if (!categoryId || !brandId) return [];
  return variations.filter(
    (v) => v.product?.categoryId === categoryId && v.product?.brandId === brandId
  );
}

export function brandIdsForCategory(variations, categoryId) {
  const ids = new Set();
  for (const v of variations) {
    if (v.product?.categoryId === categoryId && v.product?.brandId) ids.add(v.product.brandId);
  }
  return ids;
}

export function emptyLineItem() {
  return {
    categoryId: "",
    brandId: "",
    productVariationId: "",
    quantity: "",
    unitPrice: ""
  };
}

export function paymentLabel(method) {
  return PAYMENT_LABELS[method] || method;
}

export function saleStatusLabel(status) {
  return SALE_STATUS_LABELS[status] || status;
}

export function nfceJobStatusLabel(status) {
  return JOB_STATUS_LABELS[status] || status || "";
}
