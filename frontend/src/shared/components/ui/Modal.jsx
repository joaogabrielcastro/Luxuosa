import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./Button.jsx";
import { cn } from "./helpers.js";

function useDialogBehavior(open, onClose, panelRef) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const onKey = (event) => {
      if (event.key === "Escape") onCloseRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector("[data-autofocus], input:not([type=hidden]), select, textarea");
      (el || panelRef.current)?.focus?.();
    }, 30);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
    };
  }, [open, panelRef]);
}

/**
 * Diálogo modal. Em telas pequenas abre como folha inferior.
 * `actions` aparece à direita do botão de fechar. `hideClose` remove o botão de rodapé.
 */
export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  closeText = "Fechar",
  actions = null,
  size = "md",
  hideClose = false
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  useDialogBehavior(open, onClose, panelRef);

  if (!open) return null;

  const maxWidth = size === "xl" ? "sm:max-w-4xl" : size === "lg" ? "sm:max-w-2xl" : size === "sm" ? "sm:max-w-md" : "sm:max-w-xl";

  return (
    <div
      className="ui-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn("ui-modal-panel focus:outline-none", maxWidth)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 id={titleId} className="text-lg font-semibold text-slate-900">
                {title}
              </h3>
              {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
            </div>
            <button
              type="button"
              data-close
              onClick={onClose}
              className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className={cn("text-sm text-slate-700", title ? "mt-4" : "")}>{children}</div>
        {!hideClose || actions ? (
          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            {!hideClose ? (
              <Button variant="secondary" data-close onClick={onClose}>
                {closeText}
              </Button>
            ) : null}
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Painel lateral (edição/detalhe). Em telas pequenas ocupa a tela toda.
 */
export function Sheet({ open, title, description, children, onClose, footer = null, width = "max-w-xl", bodyClassName = "px-5 py-5" }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useDialogBehavior(open, onClose, panelRef);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-slate-950/30 backdrop-blur-[1px] animate-fade-in" onMouseDown={onClose} aria-hidden />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className={cn("ui-sheet-panel focus:outline-none", width)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h3>
            {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={cn("flex-1 overflow-y-auto overscroll-contain", bodyClassName)}>{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </aside>
    </>
  );
}
