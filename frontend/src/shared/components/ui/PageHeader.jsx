export function PageHeader({ title, description, actions = null, badge = null }) {
  return (
    <header className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>a]:w-full sm:[&>a]:w-auto [&>button]:w-full sm:[&>button]:w-auto [&_button]:w-full sm:[&_button]:w-auto">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
