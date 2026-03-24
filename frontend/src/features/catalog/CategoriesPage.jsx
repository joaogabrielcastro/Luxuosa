import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";

export function CategoriesPage() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await apiClient("/categories", { token });
    setItems(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createCategory(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (editingId) {
        await apiClient(`/categories/${editingId}`, { method: "PUT", token, body: { name } });
      } else {
        await apiClient("/categories", { method: "POST", token, body: { name } });
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

  async function removeCategory(id) {
    try {
      await apiClient(`/categories/${id}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Categorias</h2>
        <form className="mt-3 flex gap-2" onSubmit={createCategory}>
          <input
            className="w-full rounded-md border p-2"
            placeholder="Nome da categoria"
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

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Nome</th>
              <th className="py-2">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
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
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => removeCategory(item.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td className="py-3 text-slate-500" colSpan={2}>
                  Nenhuma categoria cadastrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
