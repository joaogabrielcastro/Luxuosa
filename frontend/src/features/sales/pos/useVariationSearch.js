import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiClient } from "../../../shared/apiClient.js";
import { unwrapList } from "../../../shared/apiList.js";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue.js";
import { groupByProduct, matchesAllWords, serverSearchTerm } from "./posUtils.js";

/**
 * Busca de variações no servidor (sem limite de catálogo em memória).
 * - com texto: busca pelo termo mais seletivo e refina localmente por todas as palavras;
 * - sem texto: lista recentes ou a categoria escolhida.
 */
export function useVariationSearch(token, { query, categoryId }) {
  const debounced = useDebouncedValue(query, 180);
  const term = serverSearchTerm(debounced);

  const q = useQuery({
    queryKey: ["catalog", token, "pos-search", term, categoryId || ""],
    enabled: Boolean(token),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    queryFn: () => {
      const params = new URLSearchParams({ take: term ? "120" : "96", skip: "0" });
      if (term) params.set("q", term);
      if (categoryId) params.set("categoryId", categoryId);
      return apiClient(`/product-variations?${params.toString()}`, { token });
    }
  });

  const variations = useMemo(() => {
    const items = unwrapList(q.data);
    return debounced.trim() ? items.filter((v) => matchesAllWords(v, debounced)) : items;
  }, [q.data, debounced]);

  const groups = useMemo(() => groupByProduct(variations), [variations]);

  return {
    variations,
    groups,
    total: Number(q.data?.total ?? 0),
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    error: q.error,
    settled: debounced === query && !q.isFetching
  };
}

/** Busca imediata (sem debounce) usada na leitura de código de barras ao apertar Enter. */
export async function fetchVariationsByCode(token, code) {
  const params = new URLSearchParams({ take: "50", skip: "0", q: String(code).trim() });
  const data = await apiClient(`/product-variations?${params.toString()}`, { token });
  return unwrapList(data);
}
