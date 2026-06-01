export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
          aria-hidden
        />
        <p className="text-sm">Carregando…</p>
      </div>
    </div>
  );
}
