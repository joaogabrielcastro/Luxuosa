export function formatCurrencyBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

/** Data e hora no padrao brasileiro: dd/mm/aaaa, hh:mm (24h). */
export function formatDateTimeBR(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

/** Apenas data: dd/mm/aaaa (aceita ISO completo ou apenas aaaa-mm-dd). */
export function formatDateBR(iso) {
  if (!iso) return "";
  const s = String(iso).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

/**
 * Formata valor monetario ja numerico (ex.: vindo da API) para exibir no input.
 * Nao divide por 100 — use ao carregar formulario de edicao.
 */
export function formatCurrencyInputValue(value) {
  if (value === "" || value === null || value === undefined) return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Valor numerico da API → texto do input (nunca use maskCurrencyInput aqui). */
export function amountToCurrencyInput(amount) {
  if (amount === "" || amount === null || amount === undefined) return "";
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return "";
  return formatCurrencyInputValue(n);
}

/**
 * Mascara digitacao no campo de moeda: cada tecla entra como centavo (ex.: 7,0,0,0 -> 70,00).
 * Use apenas no onChange, nao ao preencher valor vindo do banco.
 */
export function maskCurrencyInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits === "") return "";
  const cents = Number(digits) / 100;
  return cents.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function parseCurrencyInput(masked) {
  if (!masked) return 0;
  const normalized = String(masked).replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
