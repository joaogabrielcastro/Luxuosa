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
