import { Inbox } from "lucide-react";
import { cn } from "./helpers.js";

export function EmptyState({
  title = "Sem dados",
  description = "Nenhum registro encontrado.",
  actions = null,
  compact = false
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-5 text-center",
        compact ? "py-6" : "py-8"
      )}
    >
      <div
        className={cn(
          "mb-3 flex items-center justify-center rounded-full bg-slate-100 text-slate-400",
          compact ? "h-9 w-9" : "h-10 w-10"
        )}
      >
        <Inbox className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p> : null}
      {actions ? <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
