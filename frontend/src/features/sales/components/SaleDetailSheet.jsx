import { useQuery } from "@tanstack/react-query";
import { Ban, Pencil } from "lucide-react";
import { apiClient } from "../../../shared/apiClient.js";
import { Sheet } from "../../../shared/components/ui/Modal.jsx";
import { Badge } from "../../../shared/components/ui/Badge.jsx";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { SkeletonRows } from "../../../shared/components/ui/Skeleton.jsx";
import { formatCurrencyBRL, formatDateTimeBR } from "../../../shared/formatters.js";
import { paymentLabel, saleStatusLabel } from "../sales.utils.js";
import { variationAttributes } from "../pos/posUtils.js";
import { NfceCell } from "./NfceCell.jsx";

export function saleStatusVariant(status) {
  if (status === "PAID") return "success";
  if (status === "CANCELED") return "danger";
  return "warning";
}

/** Detalhe de uma venda com itens, pagamento e situação fiscal. */
export function SaleDetailSheet({ saleId, token, onClose, canManage, showNfce, nfceProps, onEdit, onCancel }) {
  const q = useQuery({
    queryKey: ["sales", token, "detail", saleId],
    enabled: Boolean(saleId && token),
    queryFn: () => apiClient(`/sales/${saleId}`, { token })
  });
  const sale = q.data;
  const gross = (sale?.items || []).reduce((a, it) => a + Number(it.quantity) * Number(it.unitPrice), 0);
  const discount = Math.max(gross - Number(sale?.totalValue || 0), 0);
  const locked = sale?.invoice?.status === "ISSUED";

  return (
    <Sheet
      open={Boolean(saleId)}
      onClose={onClose}
      title={sale ? `Venda ${String(sale.id).slice(-8).toUpperCase()}` : "Venda"}
      description={sale ? formatDateTimeBR(sale.occurredAt) : null}
      footer={
        sale && canManage && sale.status !== "CANCELED" ? (
          <>
            <Button variant="danger-soft" icon={Ban} disabled={locked} onClick={() => onCancel(sale)} title={locked ? "NFC-e autorizada: cancele a nota antes" : undefined}>
              Cancelar venda
            </Button>
            <Button variant="secondary" icon={Pencil} disabled={locked} onClick={() => onEdit(sale)}>
              Editar no PDV
            </Button>
          </>
        ) : null
      }
    >
      {q.isLoading ? (
        <SkeletonRows rows={6} />
      ) : q.error ? (
        <p className="text-sm text-red-700">{q.error.message}</p>
      ) : sale ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={saleStatusVariant(sale.status)} dot>
              {saleStatusLabel(sale.status)}
            </Badge>
            <Badge>
              {paymentLabel(sale.paymentMethod)}
              {sale.paymentMethod === "INSTALLMENT" ? ` · ${sale.installments}x` : ""}
            </Badge>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Cliente</dt>
              <dd className="font-medium text-slate-900">{sale.customer?.name || "Consumidor final"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Atendente</dt>
              <dd className="font-medium text-slate-900">{sale.user?.name || "—"}</dd>
            </div>
          </dl>
          <div>
            <p className="ui-eyebrow mb-2">Itens</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {(sale.items || []).map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{it.productVariation?.product?.name || "Produto"}</p>
                    <p className="text-xs text-slate-500">
                      {[variationAttributes(it.productVariation), `${it.quantity} × ${formatCurrencyBRL(it.unitPrice)}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="num shrink-0 font-medium">{formatCurrencyBRL(Number(it.quantity) * Number(it.unitPrice))}</span>
                </li>
              ))}
            </ul>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="num">{formatCurrencyBRL(gross)}</dd>
            </div>
            {discount > 0.004 ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">Desconto</dt>
                <dd className="num text-emerald-700">− {formatCurrencyBRL(discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="num">{formatCurrencyBRL(sale.totalValue)}</dd>
            </div>
          </dl>
          {showNfce ? (
            <div>
              <p className="ui-eyebrow mb-2">Nota fiscal</p>
              <NfceCell sale={sale} {...nfceProps} />
              {sale.invoice?.key ? <p className="mt-2 break-all font-mono text-2xs text-slate-500">{sale.invoice.key}</p> : null}
            </div>
          ) : null}
          {locked && canManage ? (
            <p className="text-xs text-slate-500">Venda com NFC-e autorizada não pode ser editada ou cancelada por aqui.</p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
