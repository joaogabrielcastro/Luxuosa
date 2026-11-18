/** Resposta paginada { items, total } ou array legado. */
export function unwrapList(data) {
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

/**
 * Busca todas as páginas de uma listagem paginada ({ items, total }), respeitando o
 * limite por página do servidor. `max` evita laços longos em catálogos enormes.
 */
export async function fetchAllPages(fetchPage, { take = 200, max = 5000 } = {}) {
  const items = [];
  let skip = 0;
  let total = Infinity;
  while (skip < total && items.length < max) {
    const data = await fetchPage({ take, skip });
    const page = unwrapList(data);
    total = Number.isFinite(Number(data?.total)) ? Number(data.total) : page.length < take ? skip + page.length : Infinity;
    items.push(...page);
    if (page.length < take) break;
    skip += take;
  }
  return { items, total: Number.isFinite(total) ? total : items.length };
}
