/**
 * Cabeçalho de página: título em serifa (identidade), descrição curta e ações.
 */
export function PageHeader({ title, description, actions = null, badge = null, eyebrow = null }) {
  return (
    <header className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="ui-eyebrow mb-1">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="ui-page-title">{title}</h1>
          {badge}
        </div>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>a]:flex-1 sm:[&>a]:flex-none [&>button]:flex-1 sm:[&>button]:flex-none">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
