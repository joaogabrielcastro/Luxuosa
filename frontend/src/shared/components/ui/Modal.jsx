import { Button } from "./Button.jsx";

export function Modal({ open, title, children, onClose, closeText = "Fechar", actions = null }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
      <div className="ui-surface max-h-[85vh] w-full max-w-xl overflow-auto p-4">
        {title ? <h3 className="text-base font-semibold">{title}</h3> : null}
        <div className="mt-3">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          {actions}
          <Button variant="secondary" onClick={onClose}>
            {closeText}
          </Button>
        </div>
      </div>
    </div>
  );
}
