import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

const ToastContext = createContext(null);

let toastSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "success") => {
      const id = ++toastSeq;
      setToasts((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => removeToast(id), 3200);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(100%,22rem)] flex-col gap-2 sm:bottom-6 sm:right-6"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const isError = toast.type === "error";
          return (
            <div
              key={toast.id}
              className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
                isError
                  ? "border-red-200/80 bg-white text-red-900 ring-1 ring-red-100"
                  : "border-emerald-200/80 bg-white text-emerald-900 ring-1 ring-emerald-100"
              }`}
              role="status"
            >
              {isError ? (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden />
              ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
              )}
              <p className="flex-1 leading-snug">{toast.message}</p>
              <button
                type="button"
                className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => removeToast(toast.id)}
                aria-label="Fechar notificação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast deve ser usado com ToastProvider");
  return context;
}
