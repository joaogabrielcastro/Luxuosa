import { FileDown, RotateCw } from "lucide-react";
import { Badge } from "../../../shared/components/ui/Badge.jsx";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { nfceState } from "../nfceActions.js";

/** Status fiscal de uma venda com as ações possíveis (PDF, emitir/reenviar). */
export function NfceCell({ sale, canIssue, busy, onPdf, onIssue, onShowError, compact = false }) {
  const st = nfceState(sale);
  const error = sale.invoice?.lastError || sale.nfceJob?.lastError || "";
  const canAct = canIssue && sale.status === "PAID";
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={st.variant} dot>
          {st.label}
        </Badge>
        {sale.invoice?.number ? <span className="num text-xs text-slate-500">nº {sale.invoice.number}</span> : null}
        {sale.nfceJob?.attempts && st.key !== "ISSUED" ? (
          <span className="text-2xs text-slate-400">{sale.nfceJob.attempts} tentativa(s)</span>
        ) : null}
      </div>
      {st.key === "ERROR" && error ? (
        <button
          type="button"
          className="line-clamp-2 max-w-[18rem] text-left text-xs text-red-700 underline-offset-2 hover:underline"
          onClick={() => onShowError(sale)}
          title="Ver mensagem completa"
        >
          {error}
        </button>
      ) : null}
      {!compact ? (
        <div className="flex flex-wrap gap-1.5">
          {st.key === "ISSUED" ? (
            <Button size="sm" variant="secondary" icon={FileDown} disabled={busy} onClick={() => onPdf(sale)}>
              PDF
            </Button>
          ) : null}
          {canAct && st.key !== "ISSUED" && st.key !== "PROCESSING" ? (
            <Button size="sm" variant="secondary" icon={RotateCw} disabled={busy} onClick={() => onIssue(sale)}>
              {st.key === "ERROR" ? "Tentar de novo" : st.key === "PENDING" ? "Forçar emissão" : "Emitir agora"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
