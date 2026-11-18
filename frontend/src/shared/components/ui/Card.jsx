import { cn } from "./helpers.js";

export function Card({ className = "", children, as: Tag = "section" }) {
  return <Tag className={cn("ui-surface p-4 sm:p-5", className)}>{children}</Tag>;
}
