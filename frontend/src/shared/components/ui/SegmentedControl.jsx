import { cn } from "./helpers.js";

/**
 * Seleção exclusiva compacta (períodos, R$/%, abas locais).
 * options: [{ value, label, icon? }]
 */
export function SegmentedControl({ options, value, onChange, label, size = "md", className = "", fullWidth = false }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "ui-scrollbar-none inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-slate-100 p-0.5",
        fullWidth ? "flex w-full" : "",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:opacity-40",
              size === "sm" ? "min-h-8 px-2.5 text-xs" : "min-h-9 px-3 text-[13px]",
              fullWidth ? "flex-1" : "",
              active ? "bg-white text-slate-900 shadow-card" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
