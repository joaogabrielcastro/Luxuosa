import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient, apiBaseUrl } from "../../shared/apiClient.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { ModuleNav } from "../../shared/components/ModuleNav.jsx";
import { FiscalEmitenteBanner } from "../../shared/components/FiscalEmitenteBanner.jsx";
import { fiscalModuleItems } from "../../shared/navConfig.js";
import { formatCurrencyBRL, formatDateTimeBR } from "../../shared/formatters.js";
import { nfceJobStatusLabel, paymentLabel } from "../sales/sales.utils.js";

function invoiceBadge(sale) {
  if (!sale.invoice) {
    return <Badge variant="neutral">Sem nota</Badge>;
  }
  if (sale.invoice.status === "ISSUED") {
    return <Badge variant="success">Autorizada</Badge>;
  }
  if (sale.invoice.status === "ERROR") {
    return <Badge variant="danger">Erro</Badge>;
  }
  return <Badge variant="warning">Pendente</Badge>;
}

export function FiscalInvoicesPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [nfceFilter, setNfceFilter] = useState("");
  const [skip, setSkip] = useState(0);
  const take = 50;
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    setSkip(0);
  }, [search, nfceFilter]);

  const listQuery = useQuery({
    queryKey: queryKeys.sales.summary(token, { fiscal: true, skip, take, search: search.trim(), nfceFilter }),
    enabled: Boolean(token),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("take", String(take));
      params.set("skip", String(skip));
      params.set("mode", "summary");
      if (search.trim()) params.set("q", search.trim());
      if (nfceFilter) params.set("nfce", nfceFilter);
      return apiClient(`/sales/summary?${params.toString()}`, { token });
    }
  });

  const sales = listQuery.data?.items ?? [];
  const total = Number(listQuery.data?.total ?? 0);

  async function downloadPdf(saleId) {
    setBusyId(saleId);
    try {
      const res = await fetch(`${apiBaseUrl}/invoices/sale/${saleId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Falha ao baixar PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nfce-${saleId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err.message || "Falha ao baixar PDF", "error");
    } finally {
      setBusyId("");
    }
  }

  async function retryNfce(saleId) {
    if (!isAdmin) return;
    setBusyId(saleId);
    try {
      await apiClient(`/invoices/issue/${saleId}`, { method: "POST", token });
      showToast("Emissão solicitada. Atualize a lista em instantes.");
      await listQuery.refetch();
    } catch (err) {
      showToast(err.message || "Falha ao emitir NFC-e", "error");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Notas fiscais"
        description="Documentos já emitidos ou em andamento. A emissão da nota continua na tela de Vendas."
        actions={
          <Link to="/vendas">
            <Button type="button" variant="secondary" className="text-sm">
              Ir para Vendas
            </Button>
          </Link>
        }
      />
      <ModuleNav items={fiscalModuleItems(isAdmin)} label="Fiscal" />
      <FiscalEmitenteBanner />

      <SectionCard title="Documentos">
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Buscar por pagamento ou chave…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select className="max-w-[200px]" value={nfceFilter} onChange={(e) => setNfceFilter(e.target.value)}>
            <option value="">Todas as vendas</option>
            <option value="WAITING">Sem nota</option>
            <option value="PENDING">Pendentes</option>
            <option value="ISSUED">Autorizadas</option>
            <option value="ERROR">Com erro</option>
          </Select>
        </div>

        <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
          <span>
            {listQuery.isFetching ? "Carregando…" : `Mostrando ${sales.length} de ${total}`}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={skip === 0 || listQuery.isFetching}
              onClick={() => setSkip((v) => Math.max(v - take, 0))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={skip + take >= total || listQuery.isFetching}
              onClick={() => setSkip((v) => v + take)}
            >
              Próxima
            </Button>
          </div>
        </div>

        {sales.length === 0 && !listQuery.isLoading ? (
          <EmptyState
            title="Nenhuma nota neste filtro"
            description="Finalize uma venda com NFC-e em Vendas para ver o documento aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Total</th>
                  <th className="py-2 pr-2">Pagamento</th>
                  <th className="py-2 pr-2">Nota</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap py-2 pr-2">{formatDateTimeBR(sale.occurredAt)}</td>
                    <td className="py-2 pr-2">{formatCurrencyBRL(sale.totalValue)}</td>
                    <td className="py-2 pr-2">{paymentLabel(sale.paymentMethod)}</td>
                    <td className="py-2 pr-2 align-top text-xs">
                      <div className="mb-1">{invoiceBadge(sale)}</div>
                      {sale.invoice?.number ? <div className="text-slate-600">Nº {sale.invoice.number}</div> : null}
                      {sale.nfceJob?.status && sale.nfceJob.status !== "COMPLETED" ? (
                        <div className="text-slate-500">Fila: {nfceJobStatusLabel(sale.nfceJob.status)}</div>
                      ) : null}
                      {sale.invoice?.status === "ERROR" && sale.invoice.lastError ? (
                        <div className="max-w-xs truncate text-rose-700" title={sale.invoice.lastError}>
                          {String(sale.invoice.lastError).slice(0, 80)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-col gap-1">
                        {sale.invoice?.status === "ISSUED" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            disabled={busyId === sale.id}
                            onClick={() => downloadPdf(sale.id)}
                          >
                            Baixar PDF
                          </Button>
                        ) : null}
                        {isAdmin && sale.status === "PAID" && sale.invoice?.status !== "ISSUED" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            disabled={busyId === sale.id}
                            onClick={() => retryNfce(sale.id)}
                          >
                            Emitir / tentar de novo
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
