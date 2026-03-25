export function BrandLogo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.png"
        alt="Luxuosa"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        className={compact ? "h-8 w-8 rounded-md object-cover" : "h-10 w-10 rounded-md object-cover"}
      />
      {!compact ? (
        <div className="flex flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-2">
          <span className="text-lg font-semibold text-slate-900">Luxuosa SaaS</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">NFC-e</span>
        </div>
      ) : null}
    </div>
  );
}
