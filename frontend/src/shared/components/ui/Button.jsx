import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./helpers.js";

const variants = {
  primary: "ui-btn ui-btn-primary",
  secondary: "ui-btn ui-btn-secondary",
  danger: "ui-btn ui-btn-danger",
  "danger-soft": "ui-btn ui-btn-danger-soft",
  ghost: "ui-btn ui-btn-ghost",
  ink: "ui-btn ui-btn-ink"
};

const sizes = {
  sm: "ui-btn-sm",
  md: "",
  lg: "ui-btn-lg"
};

/**
 * Botão padrão. `loading` desabilita e mostra indicador; `icon` renderiza um ícone lucide à esquerda.
 */
export const Button = forwardRef(function Button(
  { variant = "primary", size = "md", loading = false, icon: Icon = null, className = "", children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(variants[variant] || variants.primary, sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      ) : null}
      {children}
    </button>
  );
});

/** Botão só com ícone (exige aria-label). */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = "ghost", size = "md", className = "", ...props },
  ref
) {
  const dims = size === "sm" ? "h-8 w-8 min-h-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(variants[variant] || variants.ghost, dims, "px-0", className)}
      {...props}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} aria-hidden />
    </button>
  );
});
