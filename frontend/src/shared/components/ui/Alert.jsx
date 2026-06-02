import { cn } from "./helpers.js";

const variants = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-900"
};

export function Alert({ title, children, variant = "info", className = "" }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", variants[variant], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}
