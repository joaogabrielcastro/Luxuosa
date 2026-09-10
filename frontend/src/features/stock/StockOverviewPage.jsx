import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight, BellRing, FileInput, Package } from "lucide-react";
import { apiClient } from "../../shared/apiClient.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { useAuth } from "../auth/useAuth.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { ModuleNav } from "../../shared/components/ModuleNav.jsx";
import { stockModuleItems } from "../../shared/navConfig.js";
import { formatCurrencyBRL } from "../../shared/formatters.js";

function productStock(item) {
  return (item.variations || []).reduce((acc, v) => acc + Number(v.stock || 0), 0);
}

export function StockOverviewPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.type === "ADMIN";

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(token, { take: 50, skip: 0, overview: true }),
    enabled: Boolean(token),
    queryFn: () => apiClient("/products?take=50&skip=0", { token })
  });

  const lowStockQuery = useQuery({
    queryKey: queryKeys.reports.lowStock(token),
    enabled: Boolean(token),
    queryFn: () => apiClient("/reports/low-stock", { token })
  });

  const products = productsQuery.data?.items ?? [];
  const totalProducts = Number(productsQuery.data?.total ?? products.length);
  const lowItems = lowStockQuery.data?.items ?? [];
  const criticalCount = lowItems.filter(
    (item) => item.severity === "critical" || Number(item.currentStock) === 0
  ).length;

  return (
    <div className="ui-page">
      <PageHeader
        title="Estoque"
        description="Veja o que a loja tem, o que precisa repor e registre entradas."
      />
      <ModuleNav items={stockModuleItems(isAdmin)} label="Estoque" />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Produtos cadastrados"
          value={productsQuery.isLoading ? "…" : totalProducts}
          icon={<Package className="h-4 w-4 text-violet-600" />}
        />
        <StatCard
          label="Abaixo do mínimo"
          value={lowStockQuery.isLoading ? "…" : lowItems.length}
          tone={lowItems.length ? "warning" : "default"}
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
        />
        <StatCard
          label="Sem estoque"
          value={lowStockQuery.isLoading ? "…" : criticalCount}
          tone={criticalCount ? "danger" : "default"}
          icon={<AlertTriangle className="h-4 w-4 text-rose-600" />}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          to="/estoque/movimentos"
          className="rounded-xl border border-slate-200 bg-white p-4 text-inherit no-underline shadow-sm hover:border-violet-200 hover:bg-violet-50/40"
        >
          <ArrowLeftRight className="h-4 w-4 text-violet-600" />
          <p className="mt-2 text-sm font-semibold text-slate-900">Movimentações</p>
          <p className="mt-1 text-xs text-slate-600">Entrada ou saída manual, com histórico.</p>
        </Link>
        {isAdmin ? (
          <>
            <Link
              to="/estoque/importar-nfe"
              className="rounded-xl border border-slate-200 bg-white p-4 text-inherit no-underline shadow-sm hover:border-violet-200 hover:bg-violet-50/40"
            >
              <FileInput className="h-4 w-4 text-violet-600" />
              <p className="mt-2 text-sm font-semibold text-slate-900">Entradas</p>
              <p className="mt-1 text-xs text-slate-600">Importar XML de compra do fornecedor.</p>
            </Link>
            <Link
              to="/estoque/alertas"
              className="rounded-xl border border-slate-200 bg-white p-4 text-inherit no-underline shadow-sm hover:border-violet-200 hover:bg-violet-50/40"
            >
              <BellRing className="h-4 w-4 text-violet-600" />
              <p className="mt-2 text-sm font-semibold text-slate-900">Alertas</p>
              <p className="mt-1 text-xs text-slate-600">Avisos por e-mail ou WhatsApp quando faltar produto.</p>
            </Link>
          </>
        ) : null}
      </section>

      <SectionCard
        title="O que precisa repor"
        description="Comparado ao mínimo cadastrado em cada produto. Esta é a lista da loja."
        actions={
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Link to="/estoque/alertas">
                <Button type="button" variant="secondary" className="text-xs">
                  Disparar avisos
                </Button>
              </Link>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="text-xs"
              disabled={!lowItems.length}
              onClick={() => {
                const rows = [["name", "sku", "currentStock", "minStock", "severity"]];
                for (const item of lowItems) {
                  rows.push([
                    item.name,
                    item.sku || "",
                    item.currentStock,
                    item.minStock,
                    item.severity || ""
                  ]);
                }
                const body = rows
                  .map((row) =>
                    row
                      .map((value) => {
                        const s = String(value ?? "");
                        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                      })
                      .join(",")
                  )
                  .join("\r\n");
                const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "estoque_baixo.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Exportar CSV
            </Button>
          </div>
        }
      >
        {lowStockQuery.isLoading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : lowItems.length ? (
          <ul className="space-y-2 text-sm">
            {lowItems.map((item) => {
              const zero = item.severity === "critical" || Number(item.currentStock) === 0;
              return (
                <li
                  key={item.id}
                  className={`rounded-lg border px-3 py-2 ${
                    zero ? "border-rose-300 bg-rose-50 text-rose-950" : "border-amber-200 bg-amber-50 text-amber-950"
                  }`}
                >
                  <span className="font-medium">{item.name}</span>
                  {item.sku ? <span className="text-xs opacity-80"> · {item.sku}</span> : null}
                  <div className="text-xs opacity-90">
                    Atual: {item.currentStock} · Mínimo: {item.minStock}
                    {zero ? " · sem estoque" : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState description="Nenhum produto abaixo do mínimo no momento." />
        )}
        {isAdmin && lowItems.length ? (
          <div className="mt-3">
            <Link to="/estoque/movimentos" className="text-sm text-violet-700 hover:underline">
              Registrar entrada
            </Link>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Quantidade atual"
        description="Estoque somado por produto (incluindo tamanhos e cores)."
        actions={
          <Link to="/catalog/products">
            <Button type="button" variant="secondary" className="text-xs">
              Abrir produtos
            </Button>
          </Link>
        }
      >
        {productsQuery.isLoading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : products.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Produto</th>
                  <th className="py-2 pr-2">Qtd</th>
                  <th className="py-2 pr-2">Mín.</th>
                  <th className="py-2">Preço</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item) => {
                  const current = productStock(item);
                  const min = Number(item.minStock ?? 0);
                  const low = min > 0 && current <= min;
                  return (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2">{item.name}</td>
                      <td className={`py-2 pr-2 ${low ? "font-semibold text-amber-800" : ""}`}>{current}</td>
                      <td className="py-2 pr-2">{item.minStock}</td>
                      <td className="py-2">{formatCurrencyBRL(item.price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState description="Nenhum produto cadastrado." />
        )}
      </SectionCard>
    </div>
  );
}
