import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, Download, FileText } from "lucide-react";
import { apiBaseUrl } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { formatCurrencyBRL } from "../../shared/formatters.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";

function defaultPeriod() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const MONTH_OPTIONS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" }
];

export function FiscalClosingPage() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.type === "ADMIN";
  const [{ year, month }, setPeriod] = useState(defaultPeriod);
  const [applied, setApplied] = useState(defaultPeriod);
  const [exporting, setExporting] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["fiscal-closing", token, applied.year, applied.month],
    enabled: Boolean(token) && isAdmin,
    queryFn: async () => {
      const res = await fetch(
        `${apiBaseUrl}/fiscal-closing/summary?year=${applied.year}&month=${applied.month}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Falha ao carregar fechamento");
      }
      return res.json();
    }
  });

  const summary = summaryQuery.data;
  const periodLabel = useMemo(() => summary?.period?.label || `${month}/${year}`, [summary, month, year]);

  function applyPeriod(e) {
    e.preventDefault();
    setApplied({ year, month });
  }

  async function exportZip() {
    setExporting(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/fiscal-closing/export?year=${applied.year}&month=${applied.month}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Falha ao exportar pacote");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `fechamento-fiscal_${applied.year}-${String(applied.month).padStart(2, "0")}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Pacote contábil baixado.", "success");
    } catch (err) {
      showToast(err.message || "Falha ao exportar", "error");
    } finally {
      setExporting(false);
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Fechamento fiscal" description="Resumo mensal para contabilidade." />
        <EmptyState title="Acesso restrito" description="Somente administradores podem acessar o fechamento fiscal." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fechamento fiscal"
        description="Resumo mensal e pacote ZIP com NFC-e, NF-e de entrada, vendas e totais para o contador."
      />

      <SectionCard title="Período">
        <form onSubmit={applyPeriod} className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Mês</span>
            <select
              className="ui-input min-w-[160px]"
              value={month}
              onChange={(e) => setPeriod((p) => ({ ...p, month: Number(e.target.value) }))}
            >
              {MONTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Ano</span>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setPeriod((p) => ({ ...p, year: Number(e.target.value) }))}
              className="w-28"
            />
          </label>
          <Button type="submit" variant="secondary" disabled={summaryQuery.isFetching}>
            Atualizar
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={exportZip}
            disabled={exporting || summaryQuery.isLoading}
          >
            <Download className="h-4 w-4" />
            {exporting ? "Gerando ZIP..." : "Exportar pacote contábil"}
          </Button>
        </form>
      </SectionCard>

      {summaryQuery.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {summaryQuery.error.message}
        </div>
      ) : null}

      {summaryQuery.isLoading ? (
        <p className="text-sm text-slate-500">Carregando fechamento de {periodLabel}…</p>
      ) : summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="NFC-e emitidas" value={summary.nfce.issued.count} />
            <StatCard
              label="Faturamento NFC-e"
              value={formatCurrencyBRL(summary.nfce.issued.totalValue)}
            />
            <StatCard label="NF-e entrada" value={summary.nfeEntrada.imported.count} />
            <StatCard
              label="Vendas pagas"
              value={`${summary.sales.paid.count} · ${formatCurrencyBRL(summary.sales.paid.totalValue)}`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="NFC-e pendentes/erro" value={summary.nfce.pending.count + summary.nfce.error.count} />
            <StatCard label="Vendas canceladas" value={summary.sales.canceled.count} />
            <StatCard label="XMLs NFC-e no banco" value={summary.files.nfceXml} />
            <StatCard label="XMLs NF-e entrada" value={summary.files.nfeEntradaXml} />
          </div>

          <SectionCard title={`Resumo — ${summary.period.label}`}>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <span>
                  <strong>NFC-e (vendas):</strong> {summary.nfce.issued.count} emitidas —{" "}
                  {formatCurrencyBRL(summary.nfce.issued.totalValue)}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Archive className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <span>
                  <strong>NF-e de entrada:</strong> {summary.nfeEntrada.imported.count} notas —{" "}
                  {formatCurrencyBRL(summary.nfeEntrada.imported.totalValue)}
                </span>
              </li>
              <li>
                <strong>Faturamento (vendas pagas):</strong>{" "}
                {formatCurrencyBRL(summary.sales.paid.totalValue)}
              </li>
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              O ZIP inclui <code className="rounded bg-slate-100 px-1">resumo.json</code>,{" "}
              <code className="rounded bg-slate-100 px-1">resumo.txt</code>,{" "}
              <code className="rounded bg-slate-100 px-1">vendas.csv</code>, pastas{" "}
              <code className="rounded bg-slate-100 px-1">nfce/xml</code>,{" "}
              <code className="rounded bg-slate-100 px-1">nfce/pdf</code> e{" "}
              <code className="rounded bg-slate-100 px-1">nfe-entrada/xml</code>.
            </p>
            {summary.scopeNotes?.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
                {summary.scopeNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
