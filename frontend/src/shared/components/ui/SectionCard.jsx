import { Card } from "./Card.jsx";
import { cn } from "./helpers.js";

/** Card com cabeçalho (título, descrição e ações). `flush` remove o padding do conteúdo (tabelas). */
export function SectionCard({ title, description, actions = null, children, className = "", flush = false, icon: Icon = null }) {
  const hasHeader = title || description || actions;
  return (
    <Card className={cn(flush ? "p-0 sm:p-0" : "", className)}>
      {hasHeader ? (
        <div
          className={cn(
            "flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between",
            flush ? "border-b border-slate-100 px-4 py-3.5 sm:px-5" : "mb-4"
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="ui-stat-icon mt-0.5 h-8 w-8">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2> : null}
              {description ? <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{description}</p> : null}
            </div>
          </div>
          {actions ? (
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </Card>
  );
}
