import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { Modal } from "./ui/Modal.jsx";

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
  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={state.open}
        title={state.title}
        onClose={() => handleClose(false)}
        closeText={state.cancelText}
        actions={
          <Button variant={state.variant === "danger" ? "danger" : "primary"} onClick={() => handleClose(true)}>
            {state.confirmText}
          </Button>
        }
      >
        <p className="text-sm text-slate-600">{state.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm deve ser usado com ConfirmProvider");
  return context;
}
