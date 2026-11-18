import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { formatDateTimeBR } from "../../shared/formatters.js";
import { unwrapList } from "../../shared/apiList.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { VariationSearchSelect } from "../../shared/components/VariationSearchSelect.jsx";
import { SegmentedControl } from "../../shared/components/ui/SegmentedControl.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";
import { FormField } from "../../shared/components/ui/FormField.jsx";
import { variationAttributes } from "../sales/pos/posUtils.js";
import { ArrowDownLeft, ArrowUpRight, FileInput } from "lucide-react";
import { useInvalidateLuxuosa } from "../../shared/hooks/useInvalidateLuxuosa.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { ModuleNav } from "../../shared/components/ModuleNav.jsx";
import { stockModuleItems } from "../../shared/navConfig.js";

export function StockMovementsPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { refreshAfterStockMutation } = useInvalidateLuxuosa(token);
  const [submitting, setSubmitting] = useState(false);
  const [listSkip, setListSkip] = useState(0);
  const pageSize = 50;
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    type: "ENTRY",
    quantity: "1"
  });

  const movementsQuery = useQuery({
    queryKey: queryKeys.stock.movements(token, { skip: listSkip, take: pageSize }),
    enabled: Boolean(token),
    staleTime: 0,
    queryFn: () => apiClient(`/stock-movements?take=${pageSize}&skip=${listSkip}`, { token })
  });

  const movements = useMemo(() => unwrapList(movementsQuery.data), [movementsQuery.data]);
  const listLoading = movementsQuery.isLoading || movementsQuery.isFetching;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isAdmin) return;
    if (!selected) {
      showToast("Selecione o produto (tamanho e cor).", "error");
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
          productVariationId: selected.id,
          type: form.type,
          quantity: qty
        }
      });
      showToast(form.type === "ENTRY" ? "Entrada registrada." : "Saida registrada.");
      setForm((prev) => ({ ...prev, quantity: "1" }));
      setSelected(null);
      setListSkip(0);
      const listParams = { skip: 0, take: pageSize };
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: queryKeys.stock.movements(token, listParams),
          queryFn: () => apiClient(`/stock-movements?take=${pageSize}&skip=0`, { token })
        }),
        refreshAfterStockMutation()
      ]);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const qtyNum = Math.floor(Number(form.quantity));
  const current = Number(selected?.stock ?? 0);
  const after = selected && Number.isInteger(qtyNum) && qtyNum > 0 ? (form.type === "ENTRY" ? current + qtyNum : current - qtyNum) : null;
  const exitTooBig = form.type === "EXIT" && after !== null && after < 0;
  const hasMore = movements.length === pageSize;

  return (
    <div className="ui-page">
      <PageHeader
        title="Movimentações"
        description="Entradas e saídas manuais de estoque, com histórico. Vendas e cancelamentos já baixam e devolvem automaticamente."
        actions={
          isAdmin ? (
            <Link to="/estoque/importar-nfe" className="ui-btn ui-btn-secondary">
              <FileInput className="h-4 w-4" aria-hidden />
              Entrada por NF-e (XML)
            </Link>
          ) : null
        }
      />
      <ModuleNav items={stockModuleItems(isAdmin)} label="Estoque" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {isAdmin ? (
          <SectionCard title="Nova movimentação" description="Ajuste de inventário, peça avariada, uso interno ou mercadoria sem nota.">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <SegmentedControl
                fullWidth
                label="Tipo de movimentação"
                value={form.type}
                onChange={(type) => setForm((p) => ({ ...p, type }))}
                options={[
                  { value: "ENTRY", label: "Entrada", icon: ArrowDownLeft },
                  { value: "EXIT", label: "Saída", icon: ArrowUpRight }
                ]}
              />
              <FormField label="Produto, tamanho e cor" required>
                <VariationSearchSelect token={token} value={selected} onChange={setSelected} label="Produto / variação" />
              </FormField>
              <FormField label="Quantidade" required error={exitTooBig ? `A saída não pode passar do estoque atual (${current}).` : null}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                />
              </FormField>
              {after !== null && !exitTooBig ? (
                <p className="num rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Estoque: <strong className="text-slate-900">{current}</strong> → <strong className="text-slate-900">{after}</strong>
                </p>
              ) : null}
              <Button type="submit" className="w-full" loading={submitting} disabled={exitTooBig}>
                Registrar {form.type === "ENTRY" ? "entrada" : "saída"}
              </Button>
            </form>
          </SectionCard>
        ) : (
          <SectionCard title="Consulta">
            <p className="text-sm text-slate-600">Somente administradores registram entrada ou saída manual.</p>
          </SectionCard>
        )}

        <DataTable
          title="Histórico"
          description="Inclui vendas, cancelamentos, entradas por NF-e e ajustes manuais."
          data={movements}
          loading={listLoading}
          columns={[
            { key: "date", label: "Data" },
            { key: "type", label: "Tipo" },
            { key: "product", label: "Produto" },
            { key: "qty", label: "Qtd.", className: "text-right" }
          ]}
          minWidth={520}
          getRowKey={(m) => m.id}
          emptyTitle="Nenhum ajuste ainda"
          emptyMessage="Registre uma entrada ou saída, ou use Entrada por NF-e para notas do fornecedor."
          serverPagination={{
            skip: listSkip,
            take: pageSize,
            total: listSkip + movements.length + (hasMore ? 1 : 0),
            onChange: setListSkip
          }}
          renderCells={(m) => (
            <>
              <td className="num whitespace-nowrap text-slate-600">{formatDateTimeBR(m.occurredAt)}</td>
              <td>
                <Badge variant={m.type === "ENTRY" ? "success" : "warning"} dot>
                  {m.type === "ENTRY" ? "Entrada" : "Saída"}
                </Badge>
              </td>
              <td>
                <p className="font-medium text-slate-900">{m.productVariation?.product?.name}</p>
                <p className="text-xs text-slate-500">{variationAttributes(m.productVariation) || "Peça única"}</p>
              </td>
              <td className={`num text-right font-semibold ${m.type === "ENTRY" ? "text-emerald-700" : "text-amber-800"}`}>
                {m.type === "ENTRY" ? "+" : "−"}
                {m.quantity}
              </td>
            </>
          )}
          renderMobileCard={(m) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{m.productVariation?.product?.name}</p>
                <p className="text-xs text-slate-500">
                  {[variationAttributes(m.productVariation), formatDateTimeBR(m.occurredAt)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className={`num shrink-0 font-semibold ${m.type === "ENTRY" ? "text-emerald-700" : "text-amber-800"}`}>
                {m.type === "ENTRY" ? "+" : "−"}
                {m.quantity}
              </span>
            </div>
          )}
        />
      </div>
    </div>
  );
}
