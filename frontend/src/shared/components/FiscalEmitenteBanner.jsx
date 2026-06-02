import { FileCheck2, FileX2 } from "lucide-react";
import { useAuth } from "../../features/auth/useAuth.jsx";
import { formatCnpjBr } from "../formatters.js";

/**
 * Mostra qual CNPJ emite NFC-e nesta sessão (isolado por loja / tenant).
 */
export function FiscalEmitenteBanner({ compact = false }) {
  const { tenant } = useAuth();
  const fiscal = tenant?.fiscal;
  const cnpjLabel = fiscal?.emitenteCnpjFormatado || formatCnpjBr(tenant?.cnpj);
  const active = fiscal?.willEmitNfce === true;

  if (!tenant) return null;

  return (
    <div
      className={`flex gap-2 rounded-lg border px-3 py-2 text-xs leading-snug ${
        active
          ? "border-violet-200 bg-violet-50/90 text-violet-950"
          : "border-slate-200 bg-slate-50 text-slate-700"
      } ${compact ? "" : "mb-1"}`}
      title={fiscal?.message || "Contexto fiscal desta loja"}
    >
      {active ? (
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
      ) : (
        <FileX2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      )}
      <div className="min-w-0">
        <p className="font-semibold">
          {active ? "NFC-e desta loja" : "Sem NFC-e automática"}
          {cnpjLabel ? `: ${cnpjLabel}` : null}
        </p>
        {!compact && fiscal?.message ? <p className="mt-0.5 text-[11px] opacity-90">{fiscal.message}</p> : null}
        {fiscal?.envOverrideIgnored ? (
          <p className="mt-1 text-[11px] font-medium text-amber-800">
            Atenção: variável NUVEM_FISCAL_EMITENTE_CNPJ no servidor não substitui este CNPJ.
          </p>
        ) : null}
      </div>
    </div>
  );
}
