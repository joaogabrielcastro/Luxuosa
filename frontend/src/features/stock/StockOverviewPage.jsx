import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight, BellRing, Download, FileInput, Package, PackageX } from "lucide-react";
import { apiClient } from "../../shared/apiClient.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue.js";
import { useEntitlements } from "../../shared/plans/useEntitlements.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { SkeletonRows } from "../../shared/components/ui/Skeleton.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";
import { ModuleNav } from "../../shared/components/ModuleNav.jsx";
import { stockModuleItems } from "../../shared/navConfig.js";
import { formatCurrencyBRL } from "../../shared/formatters.js";
import { isDefaultVariation } from "../catalog/catalogConstants.js";
import { compareSizes } from "../sales/pos/posUtils.js";

const PAGE_SIZE = 25;

function productStock(item) {
  return (item.variations || []).reduce((acc, v) => acc + Number(v.stock || 0), 0);
}

function exportLowStockCsv(lowItems) {
  const rows = [["name", "sku", "currentStock", "minStock", "severity"]];
  for (const item of lowItems) {
    rows.push([item.name, item.sku || "", item.currentStock, item.minStock, item.severity || ""]);
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
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "estoque_baixo.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Estoque por tamanho/cor de um produto, em linha. */
function VariationStock({ item }) {
  const real = (item.variations || []).filter((v) => !isDefaultVariation(v));
  if (!real.length) return <span className="text-xs text-slate-400">Peça única</span>;
  const sorted = [...real].sort((a, b) => compareSizes(a.size, b.size) || String(a.color).localeCompare(String(b.color), "pt-BR"));
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.slice(0, 12).map((v) => (
        <span
          key={v.id}
          title={`${v.size} · ${v.color}: ${v.stock}`}
          className={`num inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs ${
            Number(v.stock) === 0 ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 text-slate-600"
          }`}
        >
          <span className="font-semibold">{v.size}</span>
          <span className="max-w-[4.5rem] truncate">{v.color}</span>
          <span className="font-semibold text-slate-900">{v.stock}</span>
        </span>
      ))}
      {sorted.length > 12 ? <span className="text-2xs text-slate-400">+{sorted.length - 12}</span> : null}
    </div>
  );
}

export function StockOverviewPage() {
  const { token, user, tenant } = useAuth();
  const { has } = useEntitlements();
  const isAdmin = user?.type === "ADMIN";
  const eventOnly = tenant?.creditEventOnly === true;
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 300);

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(token, { take: PAGE_SIZE, skip, q, overview: true }),
    enabled: Boolean(token),
    placeholderData: keepPreviousData,
    queryFn: () => {
      const sp = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(skip) });
      if (q) sp.set("q", q);
      return apiClient(`/products?${sp.toString()}`, { token });
    }
  });

  const lowStockQuery = useQuery({
    queryKey: queryKeys.reports.lowStock(token),
    enabled: Boolean(token),
    queryFn: () => apiClient("/reports/low-stock", { token })
  });

  const products = productsQuery.data?.items ?? [];
  const totalProducts = Number(productsQuery.data?.total ?? products.length);
  const lowItems = [...(lowStockQuery.data?.items ?? [])].sort((a, b) => Number(a.currentStock) - Number(b.currentStock));
  const criticalCount = lowItems.filter((item) => item.severity === "critical" || Number(item.currentStock) === 0).length;

  return (
    <div className="ui-page">
      <PageHeader
        title="Estoque"
        description="O que a loja tem por tamanho e cor, o que precisa repor e onde registrar entradas."
        actions={
          isAdmin && !eventOnly ? (
            <Link to="/estoque/movimentos" className="ui-btn ui-btn-primary">
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              Registrar movimentação
            </Link>
          ) : null
        }
      />
      <ModuleNav items={stockModuleItems(isAdmin, eventOnly)} label="Estoque" />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Produtos cadastrados" value={totalProducts} loading={productsQuery.isLoading && !q} icon={Package} />
        <StatCard
          label="Abaixo do mínimo"
          value={lowItems.length}
          loading={lowStockQuery.isLoading}
          tone={lowItems.length ? "warning" : "default"}
          icon={AlertTriangle}
        />
        <StatCard
          label="Sem estoque"
          value={criticalCount}
          loading={lowStockQuery.isLoading}
          tone={criticalCount ? "danger" : "default"}
          icon={PackageX}
        />
      </section>

      <SectionCard
        title="O que precisa repor"
        description="Comparado ao mínimo cadastrado em cada produto."
        actions={
          <>
            {isAdmin && !eventOnly ? (
              <Link to="/estoque/alertas" className="ui-btn ui-btn-secondary ui-btn-sm">
                <BellRing className="h-4 w-4" aria-hidden />
                {has("stockAlerts") ? "Disparar avisos" : "Alertas automáticos"}
              </Link>
            ) : null}
            <Button type="button" variant="secondary" size="sm" icon={Download} disabled={!lowItems.length} onClick={() => exportLowStockCsv(lowItems)}>
              Exportar CSV
            </Button>
          </>
        }
      >
        {lowStockQuery.isLoading ? (
          <SkeletonRows rows={3} />
        ) : lowItems.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {lowItems.map((item) => {
              const zero = item.severity === "critical" || Number(item.currentStock) === 0;
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[item.sku, item.brand, item.category].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={zero ? "danger" : "warning"} dot>
                      {zero ? "Sem estoque" : `${item.currentStock} un.`}
                    </Badge>
                    <p className="num mt-0.5 text-2xs text-slate-500">mínimo {item.minStock}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState compact title="Estoque em dia" description="Nenhum produto abaixo do mínimo no momento." />
        )}
      </SectionCard>

      {isAdmin && !eventOnly ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <Link to="/estoque/importar-nfe" className="ui-surface-interactive flex items-start gap-3 p-4">
            <span className="ui-stat-icon">
              <FileInput className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                Entrada por NF-e {!has("nfeImport") ? <Badge variant="champagne">Pro</Badge> : null}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">Importe o XML da compra e o estoque entra automaticamente.</span>
            </span>
          </Link>
          <Link to="/estoque/alertas" className="ui-surface-interactive flex items-start gap-3 p-4">
            <span className="ui-stat-icon">
              <BellRing className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                Alertas de estoque {!has("stockAlerts") ? <Badge variant="champagne">Pro</Badge> : null}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">Aviso por e-mail ou WhatsApp quando faltar produto.</span>
            </span>
          </Link>
        </section>
      ) : null}

      <DataTable
        title="Quantidade atual"
        description="Estoque por produto, com o detalhe de cada tamanho e cor."
        data={products}
        loading={productsQuery.isFetching}
        columns={[
          { key: "name", label: "Produto" },
          { key: "grid", label: "Tamanho · cor · qtd." },
          { key: "qty", label: "Total", className: "text-right" },
          { key: "price", label: "Preço", className: "text-right" }
        ]}
        getRowKey={(row) => row.id}
        search={{
          query: search,
          onQueryChange: (v) => {
            setSearch(v);
            setSkip(0);
          },
          placeholder: "Buscar produto ou código"
        }}
        serverPagination={{ skip, take: PAGE_SIZE, total: totalProducts, onChange: setSkip }}
        emptyTitle="Nenhum produto"
        emptyMessage={q ? "Nada encontrado para a busca." : "Cadastre produtos para acompanhar o estoque."}
        renderCells={(item) => {
          const current = productStock(item);
          const min = Number(item.minStock ?? 0);
          const low = min > 0 && current <= min;
          return (
            <>
              <td>
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{[item.sku, item.brand?.name].filter(Boolean).join(" · ")}</p>
              </td>
              <td className="max-w-[28rem]">
                <VariationStock item={item} />
              </td>
              <td className="text-right">
                {current === 0 ? (
                  <Badge variant="danger">0</Badge>
                ) : low ? (
                  <Badge variant="warning">{current}</Badge>
                ) : (
                  <span className="num font-semibold text-slate-900">{current}</span>
                )}
                {min > 0 ? <p className="num text-2xs text-slate-400">mín. {min}</p> : null}
              </td>
              <td className="num whitespace-nowrap text-right text-slate-700">{formatCurrencyBRL(item.price)}</td>
            </>
          );
        }}
        renderMobileCard={(item) => {
          const current = productStock(item);
          return (
            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate font-medium text-slate-900">{item.name}</p>
                <span className="num shrink-0 font-semibold">{current} un.</span>
              </div>
              <div className="mt-1.5">
                <VariationStock item={item} />
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
