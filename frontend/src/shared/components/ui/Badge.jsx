import { cn } from "./helpers.js";

const variants = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
  champagne: "bg-champagne-50 text-champagne-800 ring-champagne-200"
};

const dots = {
  neutral: "bg-slate-400",
  success: "bg-emerald-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  brand: "bg-brand-500",
  champagne: "bg-champagne-500"
};

/** Rótulo de status. `dot` adiciona marcador colorido (útil para status de documentos). */
export function Badge({ variant = "neutral", dot = false, className = "", children, title }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        variants[variant] || variants.neutral,
        className
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dots[variant] || dots.neutral)} aria-hidden /> : null}
      {children}
    </span>
  );
}
