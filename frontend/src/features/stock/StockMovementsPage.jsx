import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { formatDateTimeBR } from "../../shared/formatters.js";
import { unwrapList } from "../../shared/apiList.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { useCatalogTaxonomies } from "../../shared/hooks/useCatalogTaxonomies.js";
import { useInvalidateLuxuosa } from "../../shared/hooks/useInvalidateLuxuosa.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";

const VARIATIONS_LIST_Q = new URLSearchParams({ take: "500", skip: "0" }).toString();

export function StockMovementsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { refreshAfterStockMutation } = useInvalidateLuxuosa(token);
  const [submitting, setSubmitting] = useState(false);
  const [listSkip, setListSkip] = useState(0);
  const pageSize = 100;
  const [form, setForm] = useState({
    productVariationId: "",
    type: "ENTRY",
    quantity: "1"
  });

  const { variations } = useCatalogTaxonomies(token);

  const movementsQuery = useQuery({
    queryKey: queryKeys.stock.movements(token, { skip: listSkip, take: pageSize }),
    enabled: Boolean(token),
    staleTime: 0,
    queryFn: () => apiClient(`/stock-movements?take=${pageSize}&skip=${listSkip}`, { token })
  });

  const movements = useMemo(() => unwrapList(movementsQuery.data), [movementsQuery.data]);
  const listLoading = movementsQuery.isLoading || movementsQuery.isFetching;

  const sortedVariations = useMemo(
    () =>
      [...variations].sort((a, b) => {
        const an = `${a.product?.name || ""} ${a.size} ${a.color}`;
        const bn = `${b.product?.name || ""} ${b.size} ${b.color}`;
        return an.localeCompare(bn, "pt-BR");
      }),
    [variations]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.productVariationId) {
      showToast("Selecione uma variacao.", "error");
      return;
    }
    const qty = Math.floor(Number(form.quantity));
    if (!Number.isInteger(qty) || qty < 1) {
      showToast("Informe uma quantidade inteira maior ou igual a 1.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient("/stock-movements", {
        method: "POST",
        token,
        body: {
          productVariationId: form.productVariationId,
          type: form.type,
          quantity: qty
        }
      });
      showToast(form.type === "ENTRY" ? "Entrada registrada." : "Saida registrada.");
      setForm((prev) => ({ ...prev, quantity: "1" }));
      setListSkip(0);
      const listParams = { skip: 0, take: pageSize };
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: queryKeys.stock.movements(token, listParams),
          queryFn: () => apiClient(`/stock-movements?take=${pageSize}&skip=0`, { token })
        }),
        queryClient.fetchQuery({
          queryKey: queryKeys.catalog.variations(token),
          queryFn: () => apiClient(`/product-variations?${VARIATIONS_LIST_Q}`, { token })
        }),
        refreshAfterStockMutation()
      ]);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ui-page">
      <PageHeader title="Movimentacoes de estoque" description="Ajustes manuais e historico operacional." />
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Movimentacoes na pagina" value={movements.length} />
        <StatCard label="Entradas" value={movements.filter((m) => m.type === "ENTRY").length} />
        <StatCard label="Saidas" value={movements.filter((m) => m.type === "EXIT").length} />
      </section>
      <SectionCard title="Nova movimentacao">
        <p className="text-sm text-slate-600">
          Ajuste manual de estoque (entrada de mercadoria ou saida para uso interno). Vendas continuam baixando
          estoque automaticamente.
        </p>
        <form className="mt-4 grid max-w-xl gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Produto / variacao</span>
            <Select
              value={form.productVariationId}
              onChange={(e) => setForm((p) => ({ ...p, productVariationId: e.target.value }))}
            >
              <option value="">Selecione</option>
              {sortedVariations.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.product?.name} — {v.size}/{v.color} (atual: {v.stock})
                </option>
              ))}
            </Select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Tipo</span>
              <Select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="ENTRY">Entrada</option>
                <option value="EXIT">Saida</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Quantidade</span>
              <Input
                type="number"
                min={1}
                step={1}
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              />
            </label>
          </div>
          <Button type="submit" className="max-w-xs text-sm" disabled={submitting}>
            {submitting ? "Salvando..." : "Registrar"}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Historico recente">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
          <span>{listLoading ? "Carregando..." : `Mostrando ${movements.length} movimentacoes`}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={listSkip === 0 || listLoading}
              onClick={() => setListSkip((v) => Math.max(v - pageSize, 0))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={movements.length < pageSize || listLoading}
              onClick={() => setListSkip((v) => v + pageSize)}
            >
              Proxima
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2">Qtd</th>
                <th className="py-2">Produto</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    <EmptyState description="Nenhuma movimentacao manual ainda." />
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDateTimeBR(m.occurredAt)}</td>
                    <td className="py-2 pr-2">
                      <Badge variant={m.type === "ENTRY" ? "success" : "warning"}>
                        {m.type === "ENTRY" ? "Entrada" : "Saida"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2">{m.quantity}</td>
                    <td className="py-2">
                      {m.productVariation?.product?.name} — {m.productVariation?.size}/{m.productVariation?.color}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
