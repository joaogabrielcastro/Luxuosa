import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";

export function VariationsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [variations, setVariations] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    productId: "",
    size: "",
    color: "",
    stock: 0
  });

  async function load() {
    const [productsData, variationsData] = await Promise.all([
      apiClient("/products", { token }),
      apiClient("/product-variations", { token })
    ]);
    setProducts(productsData);
    setVariations(variationsData);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createVariation(event) {
    event.preventDefault();
    setError("");
    try {
      await apiClient(editingId ? `/product-variations/${editingId}` : "/product-variations", {
        method: editingId ? "PUT" : "POST",
        token,
        body: { ...form, stock: Number(form.stock) }
      });
      setEditingId("");
      setForm({ productId: "", size: "", color: "", stock: 0 });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeVariation(id) {
    try {
      await apiClient(`/product-variations/${id}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      productId: item.productId || "",
      size: item.size || "",
      color: item.color || "",
      stock: Number(item.stock || 0)
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Variacoes</h2>
        <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={createVariation}>
          <select
            className="rounded-md border p-2 md:col-span-2"
            value={form.productId}
            onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
          >
            <option value="">Selecione produto</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.sku})
              </option>
            ))}
          </select>
          <input
            className="rounded-md border p-2"
            placeholder="Tamanho"
            value={form.size}
            onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))}
          />
          <input
            className="rounded-md border p-2"
            placeholder="Cor"
            value={form.color}
            onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
          />
          <input
            className="rounded-md border p-2 md:col-span-2"
            placeholder="Estoque"
            type="number"
            value={form.stock}
            onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
          />
          <div className="flex gap-2 md:col-span-2">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-white">
              {editingId ? "Atualizar variacao" : "Salvar variacao"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="rounded-md border px-4 py-2"
                onClick={() => {
                  setEditingId("");
                  setForm({ productId: "", size: "", color: "", stock: 0 });
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Produto</th>
              <th className="py-2">Tamanho</th>
              <th className="py-2">Cor</th>
              <th className="py-2">Estoque</th>
              <th className="py-2">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {variations.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.product?.name}</td>
                <td className="py-2">{item.size}</td>
                <td className="py-2">{item.color}</td>
                <td className="py-2">{item.stock}</td>
                <td className="py-2">
                  <button className="mr-2 rounded border px-2 py-1 text-xs" onClick={() => startEdit(item)}>
                    Editar
                  </button>
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => removeVariation(item.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {!variations.length ? (
              <tr>
                <td className="py-3 text-slate-500" colSpan={5}>
                  Nenhuma variacao cadastrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
