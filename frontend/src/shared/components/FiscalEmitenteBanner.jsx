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
      className={`flex gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs leading-snug ${
        active
          ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
          : "border-slate-200 bg-slate-50 text-slate-700"
      } ${compact ? "" : "mb-1"}`}
      title={fiscal?.message || "Contexto fiscal desta loja"}
    >
      {active ? (
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <FileX2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      )}
      <div className="min-w-0">
        <p className="font-semibold">
          {active ? "NFC-e desta loja" : "Sem NFC-e automática"}
          {cnpjLabel ? `: ${cnpjLabel}` : null}
        </p>
        {!compact && fiscal?.message ? <p className="mt-0.5 text-[11px] opacity-90">{fiscal.message}</p> : null}
      </div>
    </div>
  );
}
