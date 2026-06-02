import { Card } from "./Card.jsx";
import { cn } from "./helpers.js";

export function StatCard({ label, value, hint, icon = null, tone = "default" }) {
  const tones = {
    default: "border-l-violet-500",
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
    danger: "border-l-red-500"
  };

  return (
    <Card className={cn("border-l-4 p-4", tones[tone] || tones.default)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
        </div>
        {icon ? <div className="ui-stat-icon">{icon}</div> : null}
      </div>
    </Card>
  );
}
