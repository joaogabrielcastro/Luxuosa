import { Card } from "./Card.jsx";

export function SectionCard({ title, description, actions = null, children }) {
  return (
    <Card>
      {(title || description || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </Card>
  );
}
