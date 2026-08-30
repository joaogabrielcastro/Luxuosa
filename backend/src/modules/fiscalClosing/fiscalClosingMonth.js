const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

/**
 * @param {number|string} year
 * @param {number|string} month 1-12
 */
export function parseFiscalMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) {
    const err = new Error("Ano invalido (use 2000-2100).");
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    const err = new Error("Mes invalido (use 1-12).");
    err.statusCode = 400;
    throw err;
  }
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);
  return {
    year: y,
    month: m,
    label: `${MONTH_LABELS[m - 1]}/${y}`,
    from,
    to,
    start,
    end
  };
}

export function formatMoneyBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

export function safeFileName(value, fallback = "arquivo") {
  const base = String(value || fallback)
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  return base || fallback;
}
