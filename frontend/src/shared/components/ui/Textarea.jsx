import { cn } from "./helpers.js";

export function Textarea({ className = "", ...props }) {
  return <textarea className={cn("ui-input min-h-20", className)} {...props} />;
}
