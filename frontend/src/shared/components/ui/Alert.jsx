import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "./helpers.js";

const variants = {
  info: { box: "border-sky-200 bg-sky-50/70 text-sky-950", icon: Info, iconCls: "text-sky-600" },
  success: { box: "border-emerald-200 bg-emerald-50/70 text-emerald-950", icon: CheckCircle2, iconCls: "text-emerald-600" },
  warning: { box: "border-amber-200 bg-amber-50/70 text-amber-950", icon: AlertTriangle, iconCls: "text-amber-600" },
  danger: { box: "border-red-200 bg-red-50/70 text-red-950", icon: XCircle, iconCls: "text-red-600" }
};

export function Alert({ title, children, variant = "info", className = "", actions = null }) {
  const v = variants[variant] || variants.info;
  const Icon = v.icon;
  return (
    <div role={variant === "danger" ? "alert" : undefined} className={cn("flex gap-3 rounded-xl border px-3.5 py-3 text-sm", v.box, className)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", v.iconCls)} aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-start gap-2">{actions}</div> : null}
    </div>
  );
}
