import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { apiClient } from "../../shared/apiClient.js";
import { useInvalidateLuxuosa } from "../../shared/hooks/useInvalidateLuxuosa.js";
import { useEntitlements } from "../../shared/plans/useEntitlements.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { ModuleNav } from "../../shared/components/ModuleNav.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { Modal } from "../../shared/components/ui/Modal.jsx";
import { formatCurrencyBRL, formatDateTimeBR } from "../../shared/formatters.js";
import { salesModuleItems } from "../../shared/navConfig.js";
import { paymentLabel, saleStatusLabel } from "./sales.utils.js";
import { PAYMENT_LABELS } from "./sales.constants.js";
import { useSalesList } from "./hooks/useSalesList.js";
import { NfceCell } from "./components/NfceCell.jsx";
import { SaleDetailSheet, saleStatusVariant } from "./components/SaleDetailSheet.jsx";
import { downloadNfcePdf, issueNfce } from "./nfceActions.js";

export const NFCE_FILTER_OPTIONS = [
  { value: "", label: "Todas as notas" },
  { value: "ISSUED", label: "Autorizadas" },
  { value: "PENDING", label: "Pendentes" },
  { value: "ERROR", label: "Com erro" },
  { value: "WAITING", label: "Sem registro" }
];

/** Ações fiscais compartilhadas entre Vendas e Notas fiscais. */
export function useNfceRowActions(token, onDone) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [errorDetail, setErrorDetail] = useState(null);
  return {
    busy,
    errorDetail,
    setErrorDetail,
    onShowError: (sale) => setErrorDetail(sale.invoice?.lastError || sale.nfceJob?.lastError || ""),
    onPdf: async (sale) => {
      setBusy(true);
      try {
        await downloadNfcePdf(token, sale.id);
      } catch (err) {
        showToast(err.message || "Falha ao baixar PDF", "error");
      } finally {
        setBusy(false);
      }
    },
    onIssue: async (sale) => {
      setBusy(true);
      try {
        const inv = await issueNfce(token, sale.id);
        showToast(inv?.key ? "NFC-e autorizada." : "NFC-e enviada. A lista será atualizada.");
        await onDone?.();
      } catch (err) {
        showToast(err.message || "Falha ao emitir NFC-e", "error");
      } finally {
        setBusy(false);
      }
    }
  };
}

export function NfceErrorModal({ detail, onClose }) {
  return (
    <Modal open={detail !== null} title="Motivo informado pela SEFAZ / emissor" onClose={onClose}>
      <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-800">{detail}</pre>
      <p className="mt-3 text-xs text-slate-500">
        Corrija o cadastro indicado (produto, NCM, cliente ou configuração do emissor) e use “Tentar de novo”.
      </p>
    </Modal>
  );
}

export function SalesHistoryPage() {
  const { token, tenant, user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { refreshAfterSaleMutation } = useInvalidateLuxuosa(token);
  const { has } = useEntitlements();
  const isAdmin = user?.type === "ADMIN";
  const showNfce = tenant?.enableNfceEmission === true;
  const list = useSalesList(token, { mode: "full" });
  const nfce = useNfceRowActions(token, () => list.refetch());
  const [detailId, setDetailId] = useState(null);
  const nfceProps = { canIssue: isAdmin && has("nfceEmission"), busy: nfce.busy, onPdf: nfce.onPdf, onIssue: nfce.onIssue, onShowError: nfce.onShowError };

  async function cancelSale(sale) {
    const ok = await confirm({
      title: "Cancelar venda",
      message: "A venda será cancelada e o estoque dos itens volta automaticamente.",
      confirmText: "Cancelar venda",
      cancelText: "Voltar"
    });
    if (!ok) return;
    try {
      await apiClient(`/sales/${sale.id}/cancel`, { method: "POST", token });
      showToast("Venda cancelada.");
      setDetailId(null);
      await refreshAfterSaleMutation();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  const columns = [
    { key: "date", label: "Data" },
    { key: "customer", label: "Cliente" },
    { key: "user", label: "Atendente" },
    { key: "payment", label: "Pagamento" },
    { key: "status", label: "Status" },
    ...(showNfce ? [{ key: "nfce", label: "NFC-e" }] : []),
    { key: "total", label: "Total", className: "text-right" }
  ];

  return (
    <div className="ui-page">
      <PageHeader
        title="Vendas"
        description="Histórico de vendas à vista. Toque em uma venda para ver os itens, editar ou cancelar."
        actions={
          <Link to="/vendas" className="ui-btn ui-btn-primary">
            <ShoppingBag className="h-4 w-4" aria-hidden />
            Nova venda
          </Link>
        }
      />
      <ModuleNav items={salesModuleItems()} label="Vendas" />
      {list.error ? <Alert variant="danger">{list.error.message}</Alert> : null}

      <DataTable
        data={list.sales}
        loading={list.isLoading || list.isFetching}
        columns={columns}
        getRowKey={(s) => s.id}
        onRowClick={(s) => setDetailId(s.id)}
        emptyTitle="Nenhuma venda encontrada"
        emptyMessage="Ajuste os filtros ou registre uma venda no PDV."
        serverPagination={{ skip: list.skip, take: list.take, total: list.total, onChange: list.setSkip }}
        search={{ query: list.search, onQueryChange: list.setSearch, placeholder: "Nº da venda ou chave da NFC-e" }}
        filters={[
          {
            id: "payment",
            label: "Forma de pagamento",
            value: list.paymentFilter,
            onChange: list.setPaymentFilter,
            options: [{ value: "", label: "Todos os pagamentos" }, ...Object.entries(PAYMENT_LABELS).map(([value, label]) => ({ value, label }))]
          },
          ...(showNfce
            ? [{ id: "nfce", label: "Situação da nota", value: list.nfceFilter, onChange: list.setNfceFilter, options: NFCE_FILTER_OPTIONS }]
            : [])
        ]}
        getRowClassName={(s) => (s.status === "CANCELED" ? "opacity-60" : "")}
        renderCells={(s) => (
          <>
            <td className="num whitespace-nowrap text-slate-600">{formatDateTimeBR(s.occurredAt)}</td>
            <td className="max-w-[12rem] truncate font-medium text-slate-900">{s.customer?.name || <span className="font-normal text-slate-400">Consumidor final</span>}</td>
            <td className="text-slate-600">{s.user?.name || "—"}</td>
            <td className="text-slate-600">
              {paymentLabel(s.paymentMethod)}
              {s.paymentMethod === "INSTALLMENT" ? ` · ${s.installments}x` : ""}
            </td>
            <td>
              <Badge variant={saleStatusVariant(s.status)} dot>
                {saleStatusLabel(s.status)}
              </Badge>
            </td>
            {showNfce ? (
              <td>
                <NfceCell sale={s} {...nfceProps} compact />
              </td>
            ) : null}
            <td className="num whitespace-nowrap text-right font-semibold text-slate-900">{formatCurrencyBRL(s.totalValue)}</td>
          </>
        )}
        renderMobileCard={(s) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{s.customer?.name || "Consumidor final"}</p>
              <p className="num text-xs text-slate-500">
                {formatDateTimeBR(s.occurredAt)} · {paymentLabel(s.paymentMethod)}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge variant={saleStatusVariant(s.status)} dot>
                  {saleStatusLabel(s.status)}
                </Badge>
                {showNfce ? <NfceCell sale={s} {...nfceProps} compact /> : null}
              </div>
            </div>
            <p className="num shrink-0 text-base font-semibold">{formatCurrencyBRL(s.totalValue)}</p>
          </div>
        )}
      />

      <SaleDetailSheet
        saleId={detailId}
        token={token}
        onClose={() => setDetailId(null)}
        canManage={isAdmin}
        showNfce={showNfce || Boolean(detailId)}
        nfceProps={nfceProps}
        onEdit={(sale) => navigate(`/vendas?editar=${sale.id}`)}
        onCancel={cancelSale}
      />
      <NfceErrorModal detail={nfce.errorDetail} onClose={() => nfce.setErrorDetail(null)} />
    </div>
  );
}
