import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";

export function VariationsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [variations, setVariations] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState("");
  const [form, setForm] = useState({
    productId: "",
    size: "",
    color: "",
    stock: 0
  });

  async function load() {
    const [categoriesData, productsData, variationsData] = await Promise.all([
      apiClient("/categories", { token }),
      apiClient("/products", { token }),
      apiClient("/product-variations", { token })
    ]);
    setCategories(categoriesData);
    setProducts(productsData);
    setVariations(variationsData);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createVariation(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient(editingId ? `/product-variations/${editingId}` : "/product-variations", {
        method: editingId ? "PUT" : "POST",
        token,
        body: { ...form, stock: Number(form.stock) }
      });
      showToast(editingId ? "Variacao atualizada." : "Variacao criada.");
      setEditingId("");
      setFormCategoryId("");
      setForm({ productId: "", size: "", color: "", stock: 0 });
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function removeVariation(id) {
    try {
      const confirmed = await confirm({
        title: "Excluir variacao",
        message: "Deseja excluir esta variacao?",
        confirmText: "Excluir"
      });
      if (!confirmed) return;
      await apiClient(`/product-variations/${id}`, { method: "DELETE", token });
      await load();
      showToast("Variacao excluida.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setFormCategoryId(item.product?.categoryId || "");
    setForm({
      productId: item.productId || "",
      size: item.size || "",
      color: item.color || "",
      stock: Number(item.stock || 0)
    });
  }

  const productsBySelectedCategory = products.filter((item) => !formCategoryId || item.categoryId === formCategoryId);
  const productsForListFilter = products.filter((item) => !categoryFilter || item.categoryId === categoryFilter);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Variacoes</h2>
        <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={createVariation}>
          <select
            className="rounded-md border p-2"
            value={formCategoryId}
            onChange={(e) => {
              const nextCategoryId = e.target.value;
              setFormCategoryId(nextCategoryId);
              setForm((prev) => ({ ...prev, productId: "" }));
            }}
          >
            <option value="">Selecione categoria</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border p-2"
            value={form.productId}
            disabled={!formCategoryId}
            onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
          >
            <option value="">{formCategoryId ? "Selecione produto" : "Primeiro selecione a categoria"}</option>
            {productsBySelectedCategory.map((item) => (
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
            <button className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50" disabled={loading}>
              {editingId ? "Atualizar variacao" : "Salvar variacao"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="rounded-md border px-4 py-2"
                onClick={() => {
                  setEditingId("");
                  setFormCategoryId("");
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

      <DataTable
        title="Lista de variacoes"
        data={variations}
        columns={[
          { key: "product", label: "Produto" },
          { key: "size", label: "Tamanho" },
          { key: "color", label: "Cor" },
          { key: "stock", label: "Estoque" },
          { key: "actions", label: "Acoes" }
        ]}
        getRowKey={(row) => row.id}
        emptyMessage="Nenhuma variacao encontrada."
        search={{
          query,
          onQueryChange: setQuery,
          placeholder: "Buscar por produto, tamanho ou cor...",
          matcher: (row, q) => `${row.product?.name || ""} ${row.size || ""} ${row.color || ""}`.toLowerCase().includes(q.toLowerCase())
        }}
        filters={[
          {
            id: "category",
            value: categoryFilter,
            onChange: (value) => {
              setCategoryFilter(value);
              setProductFilter("");
            },
            options: [{ value: "", label: "Todas as categorias" }, ...categories.map((item) => ({ value: item.id, label: item.name }))],
            matcher: (row, value) => row.product?.categoryId === value
          },
          {
            id: "product",
            value: productFilter,
            onChange: setProductFilter,
            options: [{ value: "", label: "Todos os produtos" }, ...productsForListFilter.map((item) => ({ value: item.id, label: item.name }))],
            matcher: (row, value) => row.productId === value
          }
        ]}
        renderCells={(item) => (
          <>
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
          </>
        )}
      />
    </div>
  );
}
