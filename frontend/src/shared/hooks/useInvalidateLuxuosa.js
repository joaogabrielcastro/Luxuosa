import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys.js";

export function useInvalidateLuxuosa(token) {
  const queryClient = useQueryClient();

  const invalidateCatalog = useCallback(async () => {
    if (!token) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all(token) });
    await queryClient.refetchQueries({ queryKey: queryKeys.catalog.all(token) });
  }, [queryClient, token]);

  const invalidateSales = useCallback(async () => {
    if (!token) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.sales.all(token) });
    await queryClient.refetchQueries({ queryKey: queryKeys.sales.all(token) });
  }, [queryClient, token]);

  const invalidateProducts = useCallback(async () => {
    if (!token) return;
    const key = queryKeys.products.all(token);
    await queryClient.invalidateQueries({ queryKey: key });
    await queryClient.refetchQueries({ queryKey: key, type: "active" });
  }, [queryClient, token]);

  const invalidateCustomers = useCallback(() => {
    if (!token) return Promise.resolve();
    return queryClient.invalidateQueries({ queryKey: queryKeys.customers.list(token) });
  }, [queryClient, token]);

  const invalidateUsers = useCallback(() => {
    if (!token) return Promise.resolve();
    return queryClient.invalidateQueries({ queryKey: queryKeys.users.list(token) });
  }, [queryClient, token]);

  const invalidateCrediario = useCallback(async () => {
    if (!token) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.crediario.all(token) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(token) })
    ]);
  }, [queryClient, token]);

  const invalidateStock = useCallback(async () => {
    if (!token) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.stock.all(token) });
    await queryClient.refetchQueries({ queryKey: queryKeys.stock.all(token) });
  }, [queryClient, token]);

  const invalidateReports = useCallback(() => {
    if (!token) return Promise.resolve();
    return queryClient.invalidateQueries({ queryKey: queryKeys.reports.all(token) });
  }, [queryClient, token]);

  const invalidateDashboard = useCallback(() => {
    if (!token) return Promise.resolve();
    return queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(token) });
  }, [queryClient, token]);

  /** Após mutação de venda: atualiza lista e estoque do catálogo. */
  const refreshAfterSaleMutation = useCallback(async () => {
    await Promise.all([invalidateSales(), invalidateCatalog(), invalidateDashboard()]);
  }, [invalidateSales, invalidateCatalog, invalidateDashboard]);

  /** Após movimentação manual ou crediário: estoque + listas relacionadas. */
  const refreshAfterStockMutation = useCallback(async () => {
    await Promise.all([
      invalidateStock(),
      invalidateCatalog(),
      invalidateProducts(),
      invalidateReports()
    ]);
  }, [invalidateStock, invalidateCatalog, invalidateProducts, invalidateReports]);

  return {
    invalidateCatalog,
    invalidateSales,
    invalidateProducts,
    invalidateCustomers,
    invalidateUsers,
    invalidateCrediario,
    invalidateStock,
    invalidateReports,
    invalidateDashboard,
    refreshAfterSaleMutation,
    refreshAfterStockMutation
  };
}
