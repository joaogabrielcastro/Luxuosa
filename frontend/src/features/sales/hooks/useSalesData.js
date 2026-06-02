import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../shared/apiClient.js";
import { queryKeys } from "../../../shared/queryKeys.js";
import { useCatalogTaxonomies } from "../../../shared/hooks/useCatalogTaxonomies.js";
import { useInvalidateLuxuosa } from "../../../shared/hooks/useInvalidateLuxuosa.js";

function computePollDelayMs(sales) {
  const active = sales.filter((s) => s.status === "PAID" && (!s.invoice || s.invoice.status === "PENDING"));
  if (!active.length) return false;

  const processingJobs = active.filter((s) => s.nfceJob?.status === "PROCESSING").length;
  const pendingJobs = active.filter((s) => s.nfceJob?.status === "PENDING").length;

  if (processingJobs > 0) return 5000;
  if (pendingJobs > 0) return 8000;
  return 12000;
}

export function useSalesData(token, { search = "", paymentFilter = "", nfceFilter = "" } = {}) {
  const [salesSkip, setSalesSkip] = useState(0);
  const salesTake = 50;
  const { refreshAfterSaleMutation } = useInvalidateLuxuosa(token);

  const salesParams = useMemo(
    () => ({
      take: salesTake,
      skip: salesSkip,
      search: search.trim(),
      paymentFilter,
      nfceFilter
    }),
    [salesSkip, salesTake, search, paymentFilter, nfceFilter]
  );

  const {
    variations,
    sortedCategories,
    sortedBrands,
    error: catalogError
  } = useCatalogTaxonomies(token);

  const salesQuery = useQuery({
    queryKey: queryKeys.sales.summary(token, salesParams),
    enabled: Boolean(token),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("take", String(salesTake));
      params.set("skip", String(salesSkip));
      params.set("mode", "summary");
      if (salesParams.search) params.set("q", salesParams.search);
      if (paymentFilter) params.set("paymentMethod", paymentFilter);
      if (nfceFilter) params.set("nfce", nfceFilter);
      return apiClient(`/sales/summary?${params.toString()}`, { token });
    },
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return computePollDelayMs(items);
    }
  });

  const sales = salesQuery.data?.items ?? [];
  const totalSales = Number(salesQuery.data?.total ?? 0);
  const error = catalogError || salesQuery.error;

  return {
    sales,
    variations,
    sortedCategories,
    sortedBrands,
    error,
    load: refreshAfterSaleMutation,
    refreshSales: () => salesQuery.refetch(),
    salesSkip,
    setSalesSkip,
    salesTake,
    totalSales,
    isLoading: salesQuery.isLoading
  };
}
