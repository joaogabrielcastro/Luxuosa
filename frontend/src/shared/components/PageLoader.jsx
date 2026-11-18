import { Skeleton } from "./ui/Skeleton.jsx";

/** Carregamento de página (lazy): esqueleto que lembra o layout final, sem pular a tela. */
export function PageLoader() {
  return (
    <div className="ui-page" role="status" aria-label="Carregando">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
