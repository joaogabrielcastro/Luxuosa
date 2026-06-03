import { JOB_STATUS_LABELS, PAYMENT_LABELS, SALE_STATUS_LABELS } from "./sales.constants.js";

export function normalizeSaleSearch(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function variationSearchHaystack(v) {
  const name = normalizeSaleSearch(v.product?.name);
  const sku = normalizeSaleSearch(v.product?.sku);
  const size = normalizeSaleSearch(v.size);
  const color = normalizeSaleSearch(v.color);
  return `${name} ${sku} ${size} ${color}`;
}

/** Busca por nome, SKU, tamanho ou cor (palavras parciais). */
export function filterVariationsBySearch(variations, query, { getRemainingUnits } = {}) {
  const q = normalizeSaleSearch(query);
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);

  return variations.filter((v) => {
    if (getRemainingUnits && getRemainingUnits(v.id) < 1) return false;
    const haystack = variationSearchHaystack(v);
    const name = normalizeSaleSearch(v.product?.name);
    const sku = normalizeSaleSearch(v.product?.sku);
    if (q === name || q === sku) return true;
    if (words.length > 1) return words.every((w) => haystack.includes(w));
    return haystack.includes(q);
  });
}

/** Correspondencia exata de SKU ou nome do produto (Enter / bip). */
export function findVariationsByExactCodeOrName(variations, raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return [];
  const q = normalizeSaleSearch(trimmed);
  return variations.filter((v) => {
    const sku = String(v.product?.sku || "").trim();
    const name = String(v.product?.name || "").trim();
    return sku === trimmed || normalizeSaleSearch(name) === q;
  });
}

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
