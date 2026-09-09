import { Card } from "./Card.jsx";

export function SectionCard({ title, description, actions = null, children }) {
  return (
    <Card>
      {(title || description || actions) && (
        <div className="mb-4 flex flex-col items-stretch gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          </div>
          {actions ? <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto sm:justify-end">{actions}</div> : null}
        </div>
      )}
      {children}
    </Card>
  );
}
