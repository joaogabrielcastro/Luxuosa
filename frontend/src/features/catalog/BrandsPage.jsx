import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";

export function BrandsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await apiClient("/brands", { token });
    setItems(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (editingId) {
        await apiClient(`/brands/${editingId}`, { method: "PUT", token, body: { name } });
        showToast("Marca atualizada.");
      } else {
        await apiClient("/brands", { method: "POST", token, body: { name } });
        showToast("Marca criada.");
      }
      setEditingId("");
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeBrand(id) {
    try {
      const confirmed = await confirm({
        title: "Excluir marca",
        message: "Deseja excluir esta marca? So e possivel se nenhum produto estiver vinculado.",
        confirmText: "Excluir"
      });
      if (!confirmed) return;
      await apiClient(`/brands/${id}`, { method: "DELETE", token });
      await load();
      showToast("Marca excluida.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Marcas</h2>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
          <input
            className="w-full rounded-md border p-2"
            placeholder="Nome da marca"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-60" disabled={loading}>
            {editingId ? "Atualizar" : "Salvar"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-md border px-4 py-2"
              onClick={() => {
                setEditingId("");
                setName("");
              }}
            >
              Cancelar
            </button>
          ) : null}
        </form>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      <DataTable
        title="Lista de marcas"
        data={items}
        columns={[
          { key: "name", label: "Nome" },
          { key: "actions", label: "Acoes" }
        ]}
        getRowKey={(row) => row.id}
        emptyMessage="Nenhuma marca encontrada."
        search={{
          query,
          onQueryChange: setQuery,
          placeholder: "Buscar marca...",
          matcher: (row, q) => row.name.toLowerCase().includes(q.toLowerCase())
        }}
        renderCells={(item) => (
          <>
            <td className="py-2">{item.name}</td>
            <td className="py-2">
              <button
                className="mr-2 rounded border px-2 py-1 text-xs"
                onClick={() => {
                  setEditingId(item.id);
                  setName(item.name);
                }}
              >
                Editar
              </button>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => removeBrand(item.id)}>
                Excluir
              </button>
            </td>
          </>
        )}
      />
    </div>
  );
}
