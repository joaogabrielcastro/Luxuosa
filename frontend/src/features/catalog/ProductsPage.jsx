import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";

export function ProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    cost: "",
    categoryId: "",
    sku: "",
    minStock: 0
  });

  async function load() {
    const [productsData, categoriesData] = await Promise.all([
      apiClient("/products", { token }),
      apiClient("/categories", { token })
    ]);
    setProducts(productsData);
    setCategories(categoriesData);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createProduct(event) {
    event.preventDefault();
    setError("");
    try {
      await apiClient(editingId ? `/products/${editingId}` : "/products", {
        method: editingId ? "PUT" : "POST",
        token,
        body: {
          ...form,
          price: Number(form.price),
          cost: Number(form.cost),
          minStock: Number(form.minStock)
        }
      });
      setEditingId("");
      setForm({ name: "", description: "", price: "", cost: "", categoryId: "", sku: "", minStock: 0 });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeProduct(id) {
    try {
      await apiClient(`/products/${id}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      description: item.description || "",
      price: Number(item.price || 0),
      cost: Number(item.cost || 0),
      categoryId: item.categoryId || "",
      sku: item.sku || "",
      minStock: Number(item.minStock || 0)
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Produtos</h2>
        <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={createProduct}>
          <input
            className="rounded-md border p-2"
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="rounded-md border p-2"
            placeholder="SKU"
            value={form.sku}
            onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
          />
          <input
            className="rounded-md border p-2"
            placeholder="Preco"
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
          />
          <input
            className="rounded-md border p-2"
            placeholder="Custo"
            type="number"
            step="0.01"
            value={form.cost}
            onChange={(e) => setForm((prev) => ({ ...prev, cost: e.target.value }))}
          />
          <input
            className="rounded-md border p-2"
            placeholder="Estoque minimo"
            type="number"
            value={form.minStock}
            onChange={(e) => setForm((prev) => ({ ...prev, minStock: e.target.value }))}
          />
          <select
            className="rounded-md border p-2"
            value={form.categoryId}
            onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
          >
            <option value="">Selecione categoria</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <textarea
            className="rounded-md border p-2 md:col-span-2"
            placeholder="Descricao"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <div className="flex gap-2 md:col-span-2">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-white">
              {editingId ? "Atualizar produto" : "Salvar produto"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="rounded-md border px-4 py-2"
                onClick={() => {
                  setEditingId("");
                  setForm({ name: "", description: "", price: "", cost: "", categoryId: "", sku: "", minStock: 0 });
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
              <th className="py-2">Nome</th>
              <th className="py-2">SKU</th>
              <th className="py-2">Categoria</th>
              <th className="py-2">Min</th>
              <th className="py-2">Atual</th>
              <th className="py-2">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {products.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.name}</td>
                <td className="py-2">{item.sku}</td>
                <td className="py-2">{item.category?.name}</td>
                <td className="py-2">{item.minStock}</td>
                <td className="py-2">{item.variations?.reduce((acc, v) => acc + v.stock, 0)}</td>
                <td className="py-2">
                  <button className="mr-2 rounded border px-2 py-1 text-xs" onClick={() => startEdit(item)}>
                    Editar
                  </button>
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => removeProduct(item.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {!products.length ? (
              <tr>
                <td className="py-3 text-slate-500" colSpan={6}>
                  Nenhum produto cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
