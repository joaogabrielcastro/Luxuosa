import { cn } from "./helpers.js";

export function Label({ children, htmlFor, required, className = "" }) {
  return (
    <label htmlFor={htmlFor} className={cn("ui-label", className)}>
      {children}
      {required ? <span className="ml-0.5 text-red-500">*</span> : null}
    </label>
  );
}
