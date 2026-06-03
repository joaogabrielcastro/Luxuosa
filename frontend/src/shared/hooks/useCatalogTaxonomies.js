import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { apiClient } from "../apiClient.js";
import { unwrapList } from "../apiList.js";
import { queryKeys } from "../queryKeys.js";

const LIST_PARAMS = new URLSearchParams({ take: "500", skip: "0" }).toString();
const CATALOG_STALE_MS = 0;

export function useCatalogTaxonomies(token) {
  const [variationsQ, categoriesQ, brandsQ] = useQueries({
    queries: [
      {
        queryKey: queryKeys.catalog.variations(token),
        enabled: Boolean(token),
        staleTime: CATALOG_STALE_MS,
        queryFn: () => apiClient(`/product-variations?${LIST_PARAMS}`, { token })
      },
      {
        queryKey: queryKeys.catalog.categories(token),
        enabled: Boolean(token),
        staleTime: CATALOG_STALE_MS,
        queryFn: () => apiClient("/categories", { token })
      },
      {
        queryKey: queryKeys.catalog.brands(token),
        enabled: Boolean(token),
        staleTime: CATALOG_STALE_MS,
        queryFn: () => apiClient("/brands", { token })
      }
    ]
  });

  const variations = useMemo(() => unwrapList(variationsQ.data), [variationsQ.data]);
  const categories = useMemo(() => unwrapList(categoriesQ.data), [categoriesQ.data]);
  const brands = useMemo(() => unwrapList(brandsQ.data), [brandsQ.data]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [categories]
  );
  const sortedBrands = useMemo(
    () => [...brands].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [brands]
  );

  const isLoading = variationsQ.isLoading || categoriesQ.isLoading || brandsQ.isLoading;
  const error = variationsQ.error || categoriesQ.error || brandsQ.error;

  return {
    variations,
    categories,
    brands,
    sortedCategories,
    sortedBrands,
    isLoading,
    error
  };
}
