import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.jsx";
import { useEntitlements } from "../../shared/plans/useEntitlements.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { ModuleNav } from "../../shared/components/ModuleNav.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { FiscalEmitenteBanner } from "../../shared/components/FiscalEmitenteBanner.jsx";
import { formatCurrencyBRL, formatDateTimeBR } from "../../shared/formatters.js";
import { fiscalModuleItems } from "../../shared/navConfig.js";
import { paymentLabel } from "../sales/sales.utils.js";
import { useSalesList } from "../sales/hooks/useSalesList.js";
import { NfceCell } from "../sales/components/NfceCell.jsx";
import { SaleDetailSheet } from "../sales/components/SaleDetailSheet.jsx";
import { NFCE_FILTER_OPTIONS, NfceErrorModal, useNfceRowActions } from "../sales/SalesHistoryPage.jsx";

/** Notas fiscais (NFC-e) emitidas a partir das vendas: status, rejeições, PDF e reemissão. */
export function FiscalInvoicesPage() {
  const { token, user } = useAuth();
  const [params] = useSearchParams();
  const { has } = useEntitlements();
  const isAdmin = user?.type === "ADMIN";
  const list = useSalesList(token, { mode: "summary", take: 30, initialNfce: params.get("status") || "" });
  const nfce = useNfceRowActions(token, () => list.refetch());
  const [detailId, setDetailId] = useState(null);
  const nfceProps = { canIssue: isAdmin && has("nfceEmission"), busy: nfce.busy, onPdf: nfce.onPdf, onIssue: nfce.onIssue, onShowError: nfce.onShowError };
  const errorsOnPage = list.sales.filter((s) => s.invoice?.status === "ERROR").length;

  return (
    <div className="ui-page">
      <PageHeader
        title="Notas fiscais"
        description="NFC-e das vendas: acompanhe a autorização, veja rejeições, baixe o PDF e reenvie quando necessário."
      />
      <ModuleNav items={fiscalModuleItems(isAdmin)} label="Fiscal" />
      <FiscalEmitenteBanner />
      {!has("nfceEmission") ? (
        <Alert variant="info" title="Emissão de NFC-e disponível a partir do plano Pro">
          As vendas continuam registradas normalmente. {isAdmin ? "Veja os planos em Assinatura." : ""}
        </Alert>
      ) : null}
      {errorsOnPage > 0 && list.nfceFilter !== "ERROR" ? (
        <Alert
          variant="warning"
          title={`${errorsOnPage} nota(s) com erro nesta página`}
          actions={
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => list.setNfceFilter("ERROR")}>
              Ver só as com erro
            </button>
          }
        />
      ) : null}
      {list.error ? <Alert variant="danger">{list.error.message}</Alert> : null}

      <DataTable
        data={list.sales}
        loading={list.isLoading || list.isFetching}
        columns={[
          { key: "date", label: "Venda" },
          { key: "nfce", label: "Situação" },
          { key: "payment", label: "Pagamento" },
          { key: "total", label: "Total", className: "text-right" }
        ]}
        getRowKey={(s) => s.id}
        onRowClick={(s) => setDetailId(s.id)}
        emptyTitle="Nenhuma nota encontrada"
        emptyMessage="As NFC-e aparecem aqui depois das vendas com emissão habilitada."
        serverPagination={{ skip: list.skip, take: list.take, total: list.total, onChange: list.setSkip }}
        search={{ query: list.search, onQueryChange: list.setSearch, placeholder: "Chave da NFC-e ou nº da venda" }}
        filters={[{ id: "nfce", label: "Situação da nota", value: list.nfceFilter, onChange: list.setNfceFilter, options: NFCE_FILTER_OPTIONS }]}
        renderCells={(s) => (
          <>
            <td className="whitespace-nowrap">
              <p className="num text-slate-900">{formatDateTimeBR(s.occurredAt)}</p>
              <p className="font-mono text-2xs text-slate-400">{String(s.id).slice(-8).toUpperCase()}</p>
            </td>
            <td className="min-w-[16rem]">
              <NfceCell sale={s} {...nfceProps} />
            </td>
            <td className="text-slate-600">{paymentLabel(s.paymentMethod)}</td>
            <td className="num whitespace-nowrap text-right font-semibold">{formatCurrencyBRL(s.totalValue)}</td>
          </>
        )}
        renderMobileCard={(s) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="num text-sm text-slate-700">{formatDateTimeBR(s.occurredAt)}</p>
              <p className="num font-semibold">{formatCurrencyBRL(s.totalValue)}</p>
            </div>
            <NfceCell sale={s} {...nfceProps} />
          </div>
        )}
      />

      <SaleDetailSheet
        saleId={detailId}
        token={token}
        onClose={() => setDetailId(null)}
        canManage={false}
        showNfce
        nfceProps={nfceProps}
      />
      <NfceErrorModal detail={nfce.errorDetail} onClose={() => nfce.setErrorDetail(null)} />
    </div>
  );
}
