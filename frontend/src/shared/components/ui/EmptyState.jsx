import { Inbox } from "lucide-react";
import { cn } from "./helpers.js";

export function EmptyState({
  title = "Sem dados",
  description = "Nenhum registro encontrado.",
  actions = null,
  compact = false,
  icon: Icon = Inbox
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-5 text-center",
        compact ? "py-6" : "py-10"
      )}
    >
      <div
        className={cn(
          "mb-3 flex items-center justify-center rounded-full bg-white text-slate-400 shadow-card ring-1 ring-slate-200/70",
          compact ? "h-9 w-9" : "h-11 w-11"
        )}
      >
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">{description}</p> : null}
      {actions ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
