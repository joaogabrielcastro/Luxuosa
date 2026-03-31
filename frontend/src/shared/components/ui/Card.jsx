import { cn } from "./helpers.js";

export function Card({ className = "", children }) {
  return <section className={cn("ui-surface p-4 md:p-5", className)}>{children}</section>;
}
