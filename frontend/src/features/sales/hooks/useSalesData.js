import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../../../shared/apiClient.js";

function computePollDelayMs(sales) {
  const active = sales.filter((s) => s.status === "PAID" && (!s.invoice || s.invoice.status === "PENDING"));
  if (!active.length) return null;

  const processingJobs = active.filter((s) => s.nfceJob?.status === "PROCESSING").length;
  const pendingJobs = active.filter((s) => s.nfceJob?.status === "PENDING").length;

  if (processingJobs > 0) return 5000;
  if (pendingJobs > 0) return 8000;
  return 12000;
}

export function useSalesData(token, { search = "", paymentFilter = "", nfceFilter = "" } = {}) {
  const [sales, setSales] = useState([]);
  const [totalSales, setTotalSales] = useState(0);
  const [salesSkip, setSalesSkip] = useState(0);
  const salesTake = 50;
  const [variations, setVariations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [error, setError] = useState("");

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [categories]
  );
  const sortedBrands = useMemo(
    () => [...brands].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [brands]
  );
  const pollDelayMs = useMemo(() => computePollDelayMs(sales), [sales]);

  const loadSales = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("take", String(salesTake));
    params.set("skip", String(salesSkip));
    params.set("mode", "summary");
    if (search.trim()) params.set("q", search.trim());
    if (paymentFilter) params.set("paymentMethod", paymentFilter);
    if (nfceFilter) params.set("nfce", nfceFilter);
    const salesData = await apiClient(`/sales/summary?${params.toString()}`, { token });
    setSales(salesData.items || []);
    setTotalSales(Number(salesData.total || 0));
  }, [token, salesSkip, salesTake, search, paymentFilter, nfceFilter]);

  const load = useCallback(async () => {
    const [variationsData, categoriesData, brandsData] = await Promise.all([
      apiClient("/product-variations", { token }),
      apiClient("/categories", { token }),
      apiClient("/brands", { token })
    ]);
    setVariations(variationsData);
    setCategories(categoriesData);
    setBrands(brandsData);
    await loadSales();
  }, [token, loadSales]);

  const refreshSales = useCallback(async () => {
    await loadSales();
  }, [loadSales]);

  useEffect(() => {
    if (!token) return undefined;
    setError("");
    load().catch((err) => setError(err.message));
    return undefined;
  }, [token, load]);

  useEffect(() => {
    if (!token) return undefined;
    if (salesSkip === 0) return undefined;
    refreshSales().catch(() => {
      /* ignore */
    });
    return undefined;
  }, [token, salesSkip, refreshSales]);

  useEffect(() => {
    if (!token) return undefined;
    refreshSales().catch(() => {
      /* ignore */
    });
    return undefined;
  }, [token, search, paymentFilter, nfceFilter, refreshSales]);

  useEffect(() => {
    if (!token || !pollDelayMs) return undefined;
    const id = setTimeout(() => {
      refreshSales().catch(() => {
        /* ignorar erro em refresh background */
      });
    }, pollDelayMs);
    return () => clearTimeout(id);
  }, [token, pollDelayMs, refreshSales]);

  return {
    sales,
    setSales,
    variations,
    categories,
    brands,
    sortedCategories,
    sortedBrands,
    error,
    setError,
    load,
    refreshSales,
    salesSkip,
    setSalesSkip,
    salesTake,
    totalSales
  };
}
