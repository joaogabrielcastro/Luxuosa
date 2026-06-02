import { useState } from "react";

/** LUXUOSA PRESENTES LTDA — tenant principal com marca Luxuosa no app. */
const LUXUOSA_BRAND_CNPJ = "12440489000100";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function LuxuosaMark({ compact }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-800 font-bold text-white shadow-md ring-1 ring-violet-500/20 ${
        compact ? "h-9 w-9 text-sm" : "h-10 w-10 text-base"
      }`}
      aria-hidden
    >
      L
    </div>
  );
}

/**
 * Identidade visual (logo ou selo). O nome da loja fica no AppShell.
 */
export function BrandLogo({ compact = false, tenant = null }) {
  const showLuxuosaBranding = digitsOnly(tenant?.cnpj) === LUXUOSA_BRAND_CNPJ;
  const [imgFailed, setImgFailed] = useState(false);

  if (showLuxuosaBranding) {
    return (
      <div className="flex shrink-0 items-center gap-2.5">
        {!imgFailed ? (
          <img
            src="/logo.png"
            alt="Luxuosa"
            onError={() => setImgFailed(true)}
            className={compact ? "h-9 w-9 rounded-xl object-cover ring-1 ring-slate-200" : "h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200"}
          />
        ) : (
          <LuxuosaMark compact={compact} />
        )}
        {!compact ? <span className="ui-brand-text hidden text-lg sm:inline">Luxuosa</span> : null}
      </div>
    );
  }

  const raw = (tenant?.name || "Loja").trim();
  const initial = raw.charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-800 font-bold text-white shadow-md ring-1 ring-violet-500/20 ${
        compact ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm"
      }`}
      title={raw}
      aria-hidden
    >
      {initial}
    </div>
  );
}
