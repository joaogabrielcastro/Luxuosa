import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { formatCurrencyBRL, maskCurrencyInput, parseCurrencyInput } from "../../shared/formatters.js";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";

export function CashRegisterPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [cash, setCash] = useState(null);
  const [error, setError] = useState("");
  const [initialValue, setInitialValue] = useState(0);
  const [movement, setMovement] = useState({ type: "WITHDRAWAL", value: 0, description: "" });
  const [finalValue, setFinalValue] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await apiClient("/cash-register/current", { token });
    setCash(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function openCash(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient("/cash-register/open", {
        method: "POST",
        token,
        body: { initialValue: parseCurrencyInput(initialValue) }
      });
      await load();
      showToast("Caixa aberto.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function addMovement(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient(`/cash-register/${cash.id}/movements`, {
        method: "POST",
        token,
        body: {
          type: movement.type,
          value: parseCurrencyInput(movement.value),
          description: movement.description
        }
      });
      setMovement({ type: "WITHDRAWAL", value: 0, description: "" });
      await load();
      showToast("Movimentacao registrada.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function closeCash(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const confirmed = await confirm({
        title: "Fechar caixa",
        message: "Deseja fechar o caixa agora?",
        confirmText: "Fechar caixa"
      });
      if (!confirmed) return;
      await apiClient(`/cash-register/${cash.id}/close`, {
        method: "POST",
        token,
        body: { finalValue: parseCurrencyInput(finalValue) }
      });
      await load();
      showToast("Caixa fechado.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Caixa diario</h2>
        {!cash ? (
          <form className="mt-3 flex gap-2" onSubmit={openCash}>
            <input
              className="rounded border p-2"
              type="number"
              placeholder="Valor inicial"
              value={initialValue}
              onChange={(e) => setInitialValue(maskCurrencyInput(e.target.value))}
            />
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={loading}>
              Abrir caixa
            </button>
          </form>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="text-sm">
              Caixa aberto em {new Date(cash.openedAt).toLocaleString()} - inicial: {formatCurrencyBRL(cash.initialValue)}
            </p>
            <form className="grid gap-2 md:grid-cols-3" onSubmit={addMovement}>
              <select
                className="rounded border p-2"
                value={movement.type}
                onChange={(e) => setMovement((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="WITHDRAWAL">Retirada</option>
                <option value="ENTRY">Entrada manual</option>
              </select>
              <input
                className="rounded border p-2"
                type="number"
                placeholder="Valor"
                value={movement.value}
                onChange={(e) => setMovement((prev) => ({ ...prev, value: maskCurrencyInput(e.target.value) }))}
              />
              <input
                className="rounded border p-2"
                placeholder="Descricao"
                value={movement.description}
                onChange={(e) => setMovement((prev) => ({ ...prev, description: e.target.value }))}
              />
              <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50 md:col-span-3" disabled={loading}>
                Registrar movimento
              </button>
            </form>
            <form className="flex gap-2" onSubmit={closeCash}>
              <input
                className="rounded border p-2"
                placeholder="Valor final contado"
                value={finalValue}
                onChange={(e) => setFinalValue(maskCurrencyInput(e.target.value))}
              />
              <button className="rounded bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={loading}>
                Fechar caixa
              </button>
            </form>
          </div>
        )}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
