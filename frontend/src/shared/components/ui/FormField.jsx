import { cn } from "./helpers.js";
import { Label } from "./Label.jsx";

/** Campo de formulário com rótulo, dica e erro alinhados. */
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  className = "",
  children
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
      {!error && hint ? <p className="ui-hint">{hint}</p> : null}
    </div>
  );
}
