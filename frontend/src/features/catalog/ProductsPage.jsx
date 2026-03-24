import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { formatCurrencyBRL, maskCurrencyInput, parseCurrencyInput } from "../../shared/formatters.js";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";

export function ProductsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
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
    setLoading(true);
    try {
      await apiClient(editingId ? `/products/${editingId}` : "/products", {
        method: editingId ? "PUT" : "POST",
        token,
        body: {
          ...form,
          price: parseCurrencyInput(form.price),
          cost: parseCurrencyInput(form.cost),
          minStock: Number(form.minStock)
        }
      });
      showToast(editingId ? "Produto atualizado." : "Produto criado.");
      setEditingId("");
      setForm({ name: "", description: "", price: "", cost: "", categoryId: "", sku: "", minStock: 0 });
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function removeProduct(id) {
    try {
      const confirmed = await confirm({
        title: "Excluir produto",
        message: "Deseja excluir este produto?",
        confirmText: "Excluir"
      });
      if (!confirmed) return;
      await apiClient(`/products/${id}`, { method: "DELETE", token });
      await load();
      showToast("Produto excluido.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      description: item.description || "",
      price: maskCurrencyInput(item.price),
      cost: maskCurrencyInput(item.cost),
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
            value={form.price}
            onChange={(e) => setForm((prev) => ({ ...prev, price: maskCurrencyInput(e.target.value) }))}
          />
          <input
            className="rounded-md border p-2"
            placeholder="Custo"
            value={form.cost}
            onChange={(e) => setForm((prev) => ({ ...prev, cost: maskCurrencyInput(e.target.value) }))}
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
            <button className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50" disabled={loading}>
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
        <DataTable
          title="Lista de produtos"
          data={products}
          columns={[
            { key: "name", label: "Nome" },
            { key: "sku", label: "SKU" },
            { key: "category", label: "Categoria" },
            { key: "min", label: "Min" },
            { key: "stock", label: "Atual" },
            { key: "price", label: "Preco" },
            { key: "actions", label: "Acoes" }
          ]}
          getRowKey={(row) => row.id}
          emptyMessage="Nenhum produto encontrado."
          search={{
            query,
            onQueryChange: setQuery,
            placeholder: "Buscar por nome ou SKU...",
            matcher: (row, q) => `${row.name} ${row.sku}`.toLowerCase().includes(q.toLowerCase())
          }}
          filters={[
            {
              id: "category",
              value: categoryFilter,
              onChange: setCategoryFilter,
              options: [{ value: "", label: "Todas as categorias" }, ...categories.map((item) => ({ value: item.id, label: item.name }))],
              matcher: (row, value) => row.categoryId === value
            }
          ]}
          renderCells={(item) => (
            <>
              <td className="py-2">{item.name}</td>
              <td className="py-2">{item.sku}</td>
              <td className="py-2">{item.category?.name}</td>
              <td className="py-2">{item.minStock}</td>
              <td className="py-2">{item.variations?.reduce((acc, v) => acc + v.stock, 0)}</td>
              <td className="py-2">{formatCurrencyBRL(item.price)}</td>
              <td className="py-2">
                <button className="mr-2 rounded border px-2 py-1 text-xs" onClick={() => startEdit(item)}>
                  Editar
                </button>
                <button className="rounded border px-2 py-1 text-xs" onClick={() => removeProduct(item.id)}>
                  Excluir
                </button>
              </td>
            </>
          )}
        />
      </div>
    </div>
  );
}
