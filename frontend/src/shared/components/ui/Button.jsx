import { cn } from "./helpers.js";

const variants = {
  primary: "ui-btn ui-btn-primary",
  secondary: "ui-btn ui-btn-secondary",
  danger: "ui-btn ui-btn-danger",
  ghost: "ui-btn text-slate-600 hover:bg-slate-100 focus:ring-slate-200"
};

export function Button({ variant = "primary", className = "", ...props }) {
  return <button className={cn(variants[variant] || variants.primary, className)} {...props} />;
}
