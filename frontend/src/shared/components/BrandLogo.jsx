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
      {!compact ? <span className="ui-brand-text text-lg">Luxuosa SaaS</span> : null}
    </div>
  );
}
