import { Inbox } from "lucide-react";

export function EmptyState({ title = "Sem dados", description = "Nenhum registro encontrado." }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Inbox className="h-6 w-6" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}
