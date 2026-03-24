import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";

export function CashRegisterPage() {
  const { token } = useAuth();
  const [cash, setCash] = useState(null);
  const [error, setError] = useState("");
  const [initialValue, setInitialValue] = useState(0);
  const [movement, setMovement] = useState({ type: "WITHDRAWAL", value: 0, description: "" });
  const [finalValue, setFinalValue] = useState(0);

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
    try {
      await apiClient("/cash-register/open", {
        method: "POST",
        token,
        body: { initialValue: Number(initialValue) }
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addMovement(event) {
    event.preventDefault();
    setError("");
    try {
      await apiClient(`/cash-register/${cash.id}/movements`, {
        method: "POST",
        token,
        body: {
          type: movement.type,
          value: Number(movement.value),
          description: movement.description
        }
      });
      setMovement({ type: "WITHDRAWAL", value: 0, description: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function closeCash(event) {
    event.preventDefault();
    setError("");
    try {
      await apiClient(`/cash-register/${cash.id}/close`, {
        method: "POST",
        token,
        body: { finalValue: Number(finalValue) }
      });
      await load();
    } catch (err) {
      setError(err.message);
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
              step="0.01"
              placeholder="Valor inicial"
              value={initialValue}
              onChange={(e) => setInitialValue(e.target.value)}
            />
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Abrir caixa</button>
          </form>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="text-sm">
              Caixa aberto em {new Date(cash.openedAt).toLocaleString()} - inicial: R$ {Number(cash.initialValue).toFixed(2)}
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
                step="0.01"
                placeholder="Valor"
                value={movement.value}
                onChange={(e) => setMovement((prev) => ({ ...prev, value: e.target.value }))}
              />
              <input
                className="rounded border p-2"
                placeholder="Descricao"
                value={movement.description}
                onChange={(e) => setMovement((prev) => ({ ...prev, description: e.target.value }))}
              />
              <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white md:col-span-3">Registrar movimento</button>
            </form>
            <form className="flex gap-2" onSubmit={closeCash}>
              <input
                className="rounded border p-2"
                type="number"
                step="0.01"
                placeholder="Valor final contado"
                value={finalValue}
                onChange={(e) => setFinalValue(e.target.value)}
              />
              <button className="rounded bg-red-700 px-3 py-2 text-sm text-white">Fechar caixa</button>
            </form>
          </div>
        )}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
