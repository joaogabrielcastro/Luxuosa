import { cn } from "./helpers.js";

export function Select({ className = "", children, ...props }) {
  return (
    <select className={cn("ui-input", className)} {...props}>
      {children}
    </select>
  );
}
