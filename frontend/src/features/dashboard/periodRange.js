/** Presets de data para GET /reports/sales (from/to YYYY-MM-DD). */

export const PERIOD_PRESETS = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mês" },
  { id: "30d", label: "Últimos 30 dias" }
];

export function formatYmd(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Segunda-feira da semana corrente (local). */
function startOfWeek(now) {
  const d = new Date(now);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - weekday);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function rangeForPreset(presetId, now = new Date()) {
  const end = startOfToday();
  end.setTime(now.getTime());
  end.setHours(0, 0, 0, 0);

  if (presetId === "today") {
    return { from: formatYmd(end), to: formatYmd(end) };
  }
  if (presetId === "week") {
    return { from: formatYmd(startOfWeek(end)), to: formatYmd(end) };
  }
  if (presetId === "30d") {
    const start = new Date(end);
    start.setDate(end.getDate() - 29);
    return { from: formatYmd(start), to: formatYmd(end) };
  }
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { from: formatYmd(start), to: formatYmd(end) };
}

/** Completa dias sem venda com amount 0 (ausência real, não dado inventado). */
export function fillDailySeries(from, to, byDay) {
  const map = new Map();
  for (const row of byDay || []) {
    if (!row?.date) continue;
    map.set(String(row.date).slice(0, 10), {
      amount: Number(row.amount || 0),
      count: Number(row.count || 0)
    });
  }
  const series = [];
  const cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return series;
  while (cursor <= end) {
    const key = formatYmd(cursor);
    const hit = map.get(key);
    series.push({
      date: key,
      amount: hit ? hit.amount : 0,
      count: hit ? hit.count : 0
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

/** Compara o último dia com o anterior; % só se o anterior for > 0. */
export function lastDayDelta(series) {
  const withActivity = (series || []).filter((row) => Number(row.amount) > 0 || Number(row.count) > 0);
  if (withActivity.length < 2) return null;
  const last = withActivity[withActivity.length - 1];
  const prev = withActivity[withActivity.length - 2];
  const current = Number(last.amount || 0);
  const previous = Number(prev.amount || 0);
  if (!(previous > 0)) return null;
  return {
    current,
    previous,
    percent: ((current - previous) / previous) * 100
  };
}
