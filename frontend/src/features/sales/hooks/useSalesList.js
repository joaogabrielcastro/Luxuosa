import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiClient } from "../../../shared/apiClient.js";
import { queryKeys } from "../../../shared/queryKeys.js";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue.js";

/** Atualiza a lista enquanto há NFC-e na fila/processando. */
export function computePollDelayMs(sales) {
  const active = sales.filter((s) => s.status === "PAID" && (!s.invoice || s.invoice.status === "PENDING") && s.nfceJob);
  if (!active.length) return false;
  if (active.some((s) => s.nfceJob?.status === "PROCESSING")) return 5000;
  if (active.some((s) => s.nfceJob?.status === "PENDING")) return 8000;
  return false;
}

/**
 * Lista paginada no servidor de vendas (GET /sales).
 * `mode`: "full" traz cliente, atendente e itens; "summary" é mais leve (notas fiscais).
 */
export function useSalesList(token, { mode = "full", take = 25, initialNfce = "" } = {}) {
  const [skip, setSkip] = useState(0);
  const [search, setSearchRaw] = useState("");
  const [paymentFilter, setPaymentFilterRaw] = useState("");
  const [nfceFilter, setNfceFilterRaw] = useState(initialNfce);
  const q = useDebouncedValue(search.trim(), 300);

  const params = useMemo(() => ({ mode, take, skip, q, paymentFilter, nfceFilter }), [mode, take, skip, q, paymentFilter, nfceFilter]);

  const query = useQuery({
    queryKey: queryKeys.sales.summary(token, params),
    enabled: Boolean(token),
    placeholderData: keepPreviousData,
    queryFn: () => {
      const sp = new URLSearchParams({ take: String(take), skip: String(skip), mode });
      if (q) sp.set("q", q);
      if (paymentFilter) sp.set("paymentMethod", paymentFilter);
      if (nfceFilter) sp.set("nfce", nfceFilter);
      return apiClient(`${mode === "summary" ? "/sales/summary" : "/sales"}?${sp.toString()}`, { token });
    },
    refetchInterval: (qq) => computePollDelayMs(qq.state.data?.items ?? [])
  });

  const resetting = (setter) => (value) => {
    setter(value);
    setSkip(0);
  };

  return {
    sales: query.data?.items ?? [],
    total: Number(query.data?.total ?? 0),
    skip,
    take,
    setSkip,
    search,
    setSearch: resetting(setSearchRaw),
    paymentFilter,
    setPaymentFilter: resetting(setPaymentFilterRaw),
    nfceFilter,
    setNfceFilter: resetting(setNfceFilterRaw),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch
  };
}
