import { formatCurrencyBRL } from "../../formatters.js";
import { cn } from "./helpers.js";

/** Valor em reais com números tabulares. */
export function Money({ value, className = "" }) {
  return <span className={cn("num", className)}>{formatCurrencyBRL(value)}</span>;
}
