/** CNPJ do tenant demo "Luxuosa Loja Demo" no seed — unica loja com marca grafica Luxuosa. */
const LUXUOSA_DEMO_CNPJ = "12345678000199";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Apenas identidade visual (logo ou selo). O nome da loja fica no AppShell, sem repetir.
 */
export function BrandLogo({ compact = false, tenant = null }) {
  const showLuxuosaBranding = digitsOnly(tenant?.cnpj) === LUXUOSA_DEMO_CNPJ;

  if (showLuxuosaBranding) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <img
          src="/logo.png"
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          className={compact ? "h-8 w-8 rounded-md object-cover" : "h-10 w-10 rounded-md object-cover"}
        />
        {!compact ? <span className="ui-brand-text hidden text-lg sm:inline">Luxuosa SaaS</span> : null}
      </div>
    );
  }

  const raw = (tenant?.name || "Loja").trim();
  const initial = raw.charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white shadow-sm ring-1 ring-indigo-600/20 ${
        compact ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm"
      }`}
      title={raw}
      aria-hidden
    >
      {initial}
    </div>
  );
}
