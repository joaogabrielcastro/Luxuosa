/** Resposta paginada { items, total } ou array legado. */
export function unwrapList(data) {
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}
