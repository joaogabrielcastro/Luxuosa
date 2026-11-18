import { cn } from "./helpers.js";

export function Skeleton({ className = "" }) {
  return <div className={cn("ui-skeleton", className)} aria-hidden />;
}

/** Bloco de linhas para estados de carregamento de listas. */
export function SkeletonRows({ rows = 5, className = "" }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
