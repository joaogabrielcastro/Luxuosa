import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "./Card.jsx";
import { cn } from "./helpers.js";
import { Skeleton } from "./Skeleton.jsx";

const toneRing = {
  default: "",
  success: "",
  warning: "ring-1 ring-inset ring-amber-200/70",
  danger: "ring-1 ring-inset ring-red-200/70"
};

const toneIcon = {
  default: "bg-brand-50 text-brand-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700"
};

/**
 * Indicador numérico. `delta` = { percent, label } mostra variação contra um período anterior.
 * `icon` aceita elemento ou componente lucide.
 */
export function StatCard({ label, value, hint, icon = null, tone = "default", footer = null, delta = null, loading = false }) {
  const IconComp = typeof icon === "function" || icon?.$$typeof === Symbol.for("react.forward_ref") ? icon : null;
  return (
    <Card className={cn("flex h-full flex-col p-4 sm:p-5", toneRing[tone] || "")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {icon ? (
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-current", toneIcon[tone] || toneIcon.default)}>
            {IconComp ? <IconComp aria-hidden /> : icon}
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-32" />
      ) : (
        <p className="num mt-1 break-words text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">{value}</p>
      )}
      {delta && Number.isFinite(delta.percent) ? (
        <p
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 text-xs font-medium",
            delta.percent > 0 ? "text-emerald-700" : delta.percent < 0 ? "text-red-700" : "text-slate-500"
          )}
        >
          {delta.percent > 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          ) : delta.percent < 0 ? (
            <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Minus className="h-3.5 w-3.5" aria-hidden />
          )}
          <span className="num">
            {delta.percent > 0 ? "+" : ""}
            {delta.percent.toFixed(0)}%
          </span>
          {delta.label ? <span className="font-normal text-slate-500">{delta.label}</span> : null}
        </p>
      ) : null}
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
      {footer ? <div className="mt-auto pt-3">{footer}</div> : null}
    </Card>
  );
}
