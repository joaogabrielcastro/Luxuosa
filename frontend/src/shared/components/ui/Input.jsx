import { cn } from "./helpers.js";

export function Input({ className = "", ...props }) {
  return <input className={cn("ui-input", className)} {...props} />;
}
