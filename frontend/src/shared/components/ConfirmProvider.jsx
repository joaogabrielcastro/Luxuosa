import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ConfirmContext = createContext(null);

const initialState = {
  open: false,
  title: "",
  message: "",
  confirmText: "Confirmar",
  cancelText: "Cancelar",
  variant: "danger"
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [resolver, setResolver] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setResolver(() => resolve);
      setState({
        open: true,
        title: options?.title || "Confirmar acao",
        message: options?.message || "Tem certeza que deseja continuar?",
        confirmText: options?.confirmText || "Confirmar",
        cancelText: options?.cancelText || "Cancelar",
        variant: options?.variant || "danger"
      });
    });
  }, []);

  const handleClose = useCallback(
    (result) => {
      if (resolver) resolver(result);
      setResolver(null);
      setState(initialState);
    },
    [resolver]
  );

  const value = useMemo(() => ({ confirm }), [confirm]);
  const confirmClass = state.variant === "danger" ? "bg-red-700 hover:bg-red-800" : "bg-slate-900 hover:bg-slate-800";

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state.open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold">{state.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{state.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border px-3 py-2 text-sm" onClick={() => handleClose(false)}>
                {state.cancelText}
              </button>
              <button className={`rounded px-3 py-2 text-sm text-white ${confirmClass}`} onClick={() => handleClose(true)}>
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm deve ser usado com ConfirmProvider");
  return context;
}
