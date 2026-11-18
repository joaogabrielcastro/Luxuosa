import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileDown, Printer, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { apiClient } from "../../../shared/apiClient.js";
import { Badge } from "../../../shared/components/ui/Badge.jsx";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { Modal } from "../../../shared/components/ui/Modal.jsx";
import { formatCurrencyBRL } from "../../../shared/formatters.js";
import { paymentLabel } from "../sales.utils.js";
import { downloadNfcePdf, nfceState } from "../nfceActions.js";

const POLL_LIMIT_MS = 90_000;

/** Confirmação após finalizar: total, troco, comprovante e acompanhamento da NFC-e. */
export function SaleSuccessModal({ receipt, token, onNewSale, onNotify }) {
  const [startedAt] = useState(() => Date.now());
  const [downloading, setDownloading] = useState(false);
  const saleId = receipt?.sale?.id;
  const track = Boolean(receipt?.nfceRequested && saleId);

  const saleQuery = useQuery({
    queryKey: ["sales", token, "detail", saleId],
    enabled: track,
    queryFn: () => apiClient(`/sales/${saleId}`, { token }),
    refetchInterval: (query) => {
      const st = nfceState(query.state.data).key;
      if (st === "ISSUED" || st === "ERROR") return false;
      return Date.now() - startedAt > POLL_LIMIT_MS ? false : 3000;
    }
  });

  if (!receipt) return null;
  const nfce = track ? nfceState(saleQuery.data || { invoice: { status: "PENDING" } }) : null;

  return (
    <Modal
      open
      size="sm"
      onClose={onNewSale}
      hideClose
      actions={
        <Button size="lg" className="w-full" icon={ShoppingBag} onClick={onNewSale} data-autofocus>
          Nova venda
        </Button>
      }
    >
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </span>
        <h3 className="mt-3 text-lg font-semibold text-slate-900">{receipt.edited ? "Venda atualizada" : "Venda concluída"}</h3>
        <p className="num mt-1 text-3xl font-semibold tracking-tight text-slate-900">{formatCurrencyBRL(receipt.totals.total)}</p>
        <p className="mt-1 text-sm text-slate-500">
          {paymentLabel(receipt.payment.paymentMethod)}
          {receipt.payment.paymentMethod === "INSTALLMENT" ? ` em ${receipt.payment.installments}x` : ""}
          {receipt.customer ? ` · ${receipt.customer.name}` : ""}
        </p>
        {receipt.change?.received && receipt.change.change > 0 ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Troco: <strong className="num">{formatCurrencyBRL(receipt.change.change)}</strong>
          </p>
        ) : null}
      </div>

      {nfce ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="text-left">
            <p className="text-[13px] font-medium text-slate-800">NFC-e</p>
            {nfce.key === "ERROR" ? (
              <Link to="/fiscal/notas?status=ERROR" className="text-xs text-red-700 hover:underline">
                Ver motivo em Notas fiscais
              </Link>
            ) : nfce.key !== "ISSUED" ? (
              <p className="text-xs text-slate-500">Você pode seguir vendendo; a nota sai em segundo plano.</p>
            ) : null}
          </div>
          {nfce.key === "ISSUED" ? (
            <Button
              size="sm"
              variant="secondary"
              icon={FileDown}
              loading={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadNfcePdf(token, saleId);
                } catch (err) {
                  onNotify(err.message, "error");
                } finally {
                  setDownloading(false);
                }
              }}
            >
              PDF
            </Button>
          ) : (
            <Badge variant={nfce.variant} dot>
              {nfce.label}
            </Badge>
          )}
        </div>
      ) : null}

      <Button variant="secondary" className="mt-3 w-full" icon={Printer} onClick={() => window.print()}>
        Imprimir comprovante
      </Button>
    </Modal>
  );
}
