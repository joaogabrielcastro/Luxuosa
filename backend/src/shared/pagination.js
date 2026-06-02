export function parsePageQuery(query, { defaultTake = 50, maxTake = 200 } = {}) {
  const takeRaw = query?.take ? Number(query.take) : defaultTake;
  const skipRaw = query?.skip ? Number(query.skip) : 0;
  const take = Math.min(Math.max(takeRaw || defaultTake, 1), maxTake);
  const skip = Math.max(skipRaw || 0, 0);
  return { take, skip };
}

export function pagedResult(items, { total, take, skip }) {
  return { items, total, take, skip };
}
