import { parseCurrencyInput } from "../../../shared/formatters.js";
import { isDefaultVariation } from "../../catalog/catalogConstants.js";
import { normalizeSaleSearch } from "../sales.utils.js";

/** Política exibida na UI; a validação definitiva continua no backend (sale.service assertDiscountPolicy). */
export const ATTENDANT_MAX_DISCOUNT_PERCENT = 10;

export const PAYMENT_OPTIONS = [
  { value: "PIX", label: "PIX" },
  { value: "CASH", label: "Dinheiro" },
  { value: "DEBIT_CARD", label: "Débito" },
  { value: "CREDIT_CARD", label: "Crédito" },
  { value: "INSTALLMENT", label: "Parcelado" }
];

export function variationName(v) {
  if (!v) return "—";
  return v.product?.name || "Produto";
}

/** "M · Preto" — vazio para a variação padrão (produto sem grade). */
export function variationAttributes(v) {
  if (!v || isDefaultVariation(v)) return "";
  return [v.size, v.color].map((s) => String(s || "").trim()).filter(Boolean).join(" · ");
}

/**
 * Termo enviado ao servidor. A API busca por nome/SKU (frase inteira), então usamos
 * a palavra mais longa e refinamos localmente por todas as palavras (inclui tamanho e cor).
 */
export function serverSearchTerm(query) {
  const raw = String(query || "").trim();
  if (!raw) return "";
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return raw;
  return [...words].sort((a, b) => b.length - a.length)[0];
}

export function matchesAllWords(v, query) {
  const q = normalizeSaleSearch(query);
  if (!q) return true;
  const hay = normalizeSaleSearch(
    [v.product?.name, v.product?.sku, v.sku, v.size, v.color, v.product?.brand?.name, v.product?.category?.name].join(" ")
  );
  return q.split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/** Agrupa variações por produto preservando a ordem de chegada. */
export function groupByProduct(variations) {
  const map = new Map();
  for (const v of variations || []) {
    const pid = v.product?.id || v.productId;
    if (!pid) continue;
    let group = map.get(pid);
    if (!group) {
      group = { productId: pid, product: v.product, variations: [] };
      map.set(pid, group);
    }
    group.variations.push(v);
  }
  return [...map.values()].map((g) => ({
    ...g,
    totalStock: g.variations.reduce((acc, v) => acc + Number(v.stock || 0), 0),
    hasGrid: g.variations.some((v) => !isDefaultVariation(v))
  }));
}

/** Leitura de etiqueta: SKU da variação, depois SKU/nome exato do produto. */
export function exactCodeMatches(variations, code) {
  const trimmed = String(code || "").trim();
  if (!trimmed) return [];
  const bySku = variations.filter((v) => String(v.sku || "").trim() === trimmed);
  if (bySku.length) return bySku;
  const q = normalizeSaleSearch(trimmed);
  return variations.filter(
    (v) => String(v.product?.sku || "").trim() === trimmed || normalizeSaleSearch(v.product?.name) === q
  );
}

/** Ordena tamanhos de forma natural para moda (PP..XGG, números). */
const SIZE_ORDER = ["RN", "PP", "P", "M", "G", "GG", "XG", "XGG", "EG", "EGG", "G1", "G2", "G3", "G4", "U", "UN", "UNICO", "ÚNICO"];
export function compareSizes(a, b) {
  const A = String(a || "").trim().toUpperCase();
  const B = String(b || "").trim().toUpperCase();
  const na = Number(A.replace(",", "."));
  const nb = Number(B.replace(",", "."));
  if (Number.isFinite(na) && Number.isFinite(nb) && A !== "" && B !== "") return na - nb;
  const ia = SIZE_ORDER.indexOf(A);
  const ib = SIZE_ORDER.indexOf(B);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return A.localeCompare(B, "pt-BR");
}

/** Monta a grade tamanho × cor de um produto. */
export function buildGrid(variations) {
  const sizes = [...new Set(variations.map((v) => String(v.size || "").trim()))].sort(compareSizes);
  const colors = [...new Set(variations.map((v) => String(v.color || "").trim()))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const cell = new Map(variations.map((v) => [`${String(v.size || "").trim()}|${String(v.color || "").trim()}`, v]));
  return { sizes, colors, get: (size, color) => cell.get(`${size}|${color}`) || null };
}

export function lineSubtotal(line) {
  const qty = Number(line.quantity);
  const unit = parseCurrencyInput(line.unitPrice);
  if (!Number.isInteger(qty) || qty < 1 || unit <= 0) return 0;
  return qty * unit;
}

/**
 * Totais: mesmo cálculo do backend (bruto − desconto em R$ − bruto × %/100, mínimo 0).
 */
export function computeTotals(lines, { discountMode, discountInput }) {
  const gross = lines.reduce((acc, l) => acc + lineSubtotal(l), 0);
  const itemCount = lines.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0);
  let discountValue = 0;
  let discountPercent = 0;
  if (discountMode === "percent") {
    const p = Number(String(discountInput || "").replace(",", "."));
    discountPercent = Number.isFinite(p) && p > 0 ? p : 0;
  } else {
    const v = parseCurrencyInput(discountInput);
    discountValue = v > 0 ? v : 0;
  }
  const discountAmount = discountValue + (gross * discountPercent) / 100;
  const total = Math.max(gross - discountAmount, 0);
  const effectivePercent = gross > 0 ? (discountAmount / gross) * 100 : 0;
  return { gross, itemCount, discountValue, discountPercent, discountAmount, total, effectivePercent };
}

/** Mensagem de bloqueio de desconto (null = ok). Espelha a regra do backend. */
export function discountIssue(totals, userType) {
  if (totals.discountPercent > 100) return "O desconto não pode passar de 100%.";
  if (totals.discountValue > totals.gross && totals.gross > 0) return "O desconto é maior que o valor dos itens.";
  if (userType === "ATTENDANT") {
    const maxValue = totals.gross * (ATTENDANT_MAX_DISCOUNT_PERCENT / 100);
    if (totals.discountPercent > ATTENDANT_MAX_DISCOUNT_PERCENT || totals.discountValue > maxValue + 1e-9) {
      return `Atendentes podem aplicar até ${ATTENDANT_MAX_DISCOUNT_PERCENT}% de desconto.`;
    }
  }
  return null;
}

/** Corpo do POST/PUT /sales — mesmo contrato usado antes do redesenho. */
export function buildSalePayload({ lines, totals, paymentMethod, installments, customerId, emitNfce, editing }) {
  const body = {
    paymentMethod,
    installments: paymentMethod === "INSTALLMENT" ? Math.max(2, Number(installments) || 2) : 1,
    discountValue: totals.discountValue,
    discountPercent: totals.discountPercent,
    customerId: customerId || null,
    items: lines.map((l) => ({
      productVariationId: l.variation.id,
      quantity: Number(l.quantity),
      unitPrice: parseCurrencyInput(l.unitPrice)
    }))
  };
  if (!editing) body.emitNfce = emitNfce !== false;
  return body;
}

/** Troco para pagamento em dinheiro (somente exibição). */
export function computeChange(total, receivedInput) {
  const received = parseCurrencyInput(receivedInput);
  if (!received) return { received: 0, change: 0, missing: 0 };
  return {
    received,
    change: Math.max(received - total, 0),
    missing: Math.max(total - received, 0)
  };
}
