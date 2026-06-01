export function PageHeader({ title, description, actions = null, badge = null }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {badge}
        </div>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
