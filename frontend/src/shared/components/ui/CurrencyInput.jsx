import { Input } from "./Input.jsx";
import { maskCurrencyInput } from "../../formatters.js";

/**
 * Campo de moeda (BRL). onChange recebe o texto ja mascarado (ex.: "70,00").
 * Ao carregar da API, use amountToCurrencyInput no estado — nao maskCurrencyInput.
 */
export function CurrencyInput({ value, onChange, className = "", placeholder = "0,00", ...props }) {
  return (
    <Input
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      className={className}
      {...props}
      value={value ?? ""}
      onChange={(e) => onChange(maskCurrencyInput(e.target.value))}
    />
  );
}
