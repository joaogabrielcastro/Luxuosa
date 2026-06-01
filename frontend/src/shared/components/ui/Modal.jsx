import { useEffect } from "react";
import { Button } from "./Button.jsx";

export function Modal({ open, title, children, onClose, closeText = "Fechar", actions = null, size = "md" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const maxWidth = size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-md" : "max-w-xl";

  return (
    <div
      className="ui-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`ui-modal-panel ${maxWidth}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <h3 id="modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h3>
        ) : null}
        <div className="mt-4 text-sm text-slate-700">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          {actions}
          <Button variant="secondary" onClick={onClose}>
            {closeText}
          </Button>
        </div>
      </div>
    </div>
  );
}
