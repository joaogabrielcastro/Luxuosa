import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { formatCurrencyBRL, maskCurrencyInput, parseCurrencyInput } from "../../shared/formatters.js";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Textarea } from "../../shared/components/ui/Textarea.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";

const AUTO_VARIATION_SIZE = "AUTO";
const AUTO_VARIATION_COLOR = "ESTOQUE";
const EMPTY_PRODUCT_FORM = {
  name: "",
  description: "",
  price: "",
  cost: "",
  categoryId: "",
  brandId: "",
  sku: "",
  minStock: ""
};

export function ProductsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [productSkip, setProductSkip] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const productTake = 50;
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [error, setError] = useState("");
  const [scannerSku, setScannerSku] = useState("");
  const [form, setForm] = useState(EMPTY_PRODUCT_FORM);
  const [currentStockPreview, setCurrentStockPreview] = useState(0);

  async function load() {
    setListLoading(true);
    const params = new URLSearchParams();
    params.set("take", String(productTake));
    params.set("skip", String(productSkip));
    if (query.trim()) params.set("q", query.trim());
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (brandFilter) params.set("brandId", brandFilter);
    const [productsData, categoriesData, brandsData] = await Promise.all([
      apiClient(`/products?${params.toString()}`, { token }),
      apiClient("/categories", { token }),
      apiClient("/brands", { token })
    ]);
    setProducts(productsData.items || []);
    setTotalProducts(Number(productsData.total || 0));
    setCategories(categoriesData);
    setBrands(brandsData);
    setListLoading(false);
  }

  useEffect(() => {
    load().catch((err) => {
      setListLoading(false);
      setError(err.message);
    });
  }, [productSkip, token, query, categoryFilter, brandFilter]);

  useEffect(() => {
    setProductSkip(0);
  }, [query, categoryFilter, brandFilter]);

  async function syncProductStock(productId, desiredStock) {
    const product = await apiClient(`/products/${productId}`, { token });
    const desired = Number(desiredStock || 0);
    const current = (product.variations || []).reduce((acc, variation) => acc + Number(variation.stock || 0), 0);
    const autoVariation = (product.variations || []).find(
      (variation) => variation.size === AUTO_VARIATION_SIZE && variation.color === AUTO_VARIATION_COLOR
    );

    if (desired === current) return;

    if (desired > current) {
      const increment = desired - current;
      if (autoVariation) {
        await apiClient(`/product-variations/${autoVariation.id}`, {
          method: "PUT",
          token,
          body: { stock: Number(autoVariation.stock) + increment }
        });
      } else {
        await apiClient("/product-variations", {
          method: "POST",
          token,
          body: {
            productId,
            size: AUTO_VARIATION_SIZE,
            color: AUTO_VARIATION_COLOR,
            stock: increment
          }
        });
      }
      return;
    }

    const decrement = current - desired;
    if (!autoVariation || Number(autoVariation.stock) < decrement) {
      throw new Error("Nao foi possivel reduzir o estoque atual por aqui. Ajuste as variacoes em 'Variacoes'.");
    }

    await apiClient(`/product-variations/${autoVariation.id}`, {
      method: "PUT",
      token,
      body: { stock: Number(autoVariation.stock) - decrement }
    });
  }

  async function createProduct(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await apiClient(editingId ? `/products/${editingId}` : "/products", {
        method: editingId ? "PUT" : "POST",
        token,
        body: {
          ...form,
          price: parseCurrencyInput(form.price),
          cost: parseCurrencyInput(form.cost),
          minStock: Number(form.minStock || 0)
        }
      });
      const productId = editingId || response?.id;
      if (productId) {
        await syncProductStock(productId, currentStockPreview);
      }
      showToast(editingId ? "Produto atualizado." : "Produto criado.");
      setEditingId("");
      setForm(EMPTY_PRODUCT_FORM);
      setCurrentStockPreview(0);
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
      brandId: item.brandId || "",
      sku: item.sku || "",
      minStock: Number(item.minStock || 0)
    });
    setCurrentStockPreview(item.variations?.reduce((acc, v) => acc + v.stock, 0) || 0);
  }

  function applyScannedSku() {
    const normalized = String(scannerSku || "").trim();
    if (!normalized) return;
    setForm((prev) => ({ ...prev, sku: normalized }));
    setScannerSku("");
    showToast("Codigo lido e aplicado no SKU.");
  }

  return (
    <div className="ui-page">
      <PageHeader title="Produtos" description="Cadastre e mantenha seu catalogo principal." />
      <SectionCard title={editingId ? "Editar produto" : "Novo produto"}>
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-600">
            Leitor de codigo de barras: clique no campo, bip no scanner e pressione Enter.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Aguardando leitura do scanner..."
              value={scannerSku}
              onChange={(e) => setScannerSku(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyScannedSku();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={applyScannedSku}>
              Aplicar codigo
            </Button>
          </div>
        </div>
        <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={createProduct}>
          <Input
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            placeholder="SKU"
            value={form.sku}
            onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
          />
          <Input
            placeholder="Preco"
            value={form.price}
            onChange={(e) => setForm((prev) => ({ ...prev, price: maskCurrencyInput(e.target.value) }))}
          />
          <Input
            placeholder="Custo"
            value={form.cost}
            onChange={(e) => setForm((prev) => ({ ...prev, cost: maskCurrencyInput(e.target.value) }))}
          />
          <div>
            <Input
              placeholder="Quantidade minima"
              type="number"
              min="0"
              value={form.minStock}
              onChange={(e) => setForm((prev) => ({ ...prev, minStock: e.target.value }))}
            />
          </div>
          <div>
            <Input
              placeholder="Quantidade atual"
              type="number"
              value={form.stock}
              min="0"
              onChange={(e) => setCurrentStockPreview(e.target.value)}
            />
          </div>
          <Select
            value={form.categoryId}
            onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
          >
            <option value="">Selecione categoria</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            value={form.brandId}
            onChange={(e) => setForm((prev) => ({ ...prev, brandId: e.target.value }))}
          >
            <option value="">Selecione marca</option>
            {brands.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Textarea
            className="md:col-span-2"
            placeholder="Descricao"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <div className="flex gap-2 md:col-span-2">
            <Button disabled={loading}>
              {editingId ? "Atualizar produto" : "Salvar produto"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingId("");
                  setForm(EMPTY_PRODUCT_FORM);
                  setCurrentStockPreview(0);
                }}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <Alert className="mt-2" variant="danger">{error}</Alert> : null}
      </SectionCard>

      <SectionCard title="Lista de produtos">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
          <span>{listLoading ? "Carregando..." : `Mostrando ${products.length} de ${totalProducts} produtos`}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={productSkip === 0 || listLoading}
              onClick={() => setProductSkip((v) => Math.max(v - productTake, 0))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={productSkip + productTake >= totalProducts || listLoading}
              onClick={() => setProductSkip((v) => v + productTake)}
            >
              Proxima
            </Button>
          </div>
        </div>
        <DataTable
          data={products}
          columns={[
            { key: "name", label: "Nome" },
            { key: "sku", label: "SKU" },
            { key: "category", label: "Categoria" },
            { key: "brand", label: "Marca" },
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
            matcher: () => true
          }}
          filters={[
            {
              id: "category",
              value: categoryFilter,
              onChange: (v) => {
                setCategoryFilter(v);
                setBrandFilter("");
              },
              options: [{ value: "", label: "Todas as categorias" }, ...categories.map((item) => ({ value: item.id, label: item.name }))],
              matcher: () => true
            },
            {
              id: "brand",
              value: brandFilter,
              onChange: setBrandFilter,
              options: [{ value: "", label: "Todas as marcas" }, ...brands.map((item) => ({ value: item.id, label: item.name }))],
              matcher: () => true
            }
          ]}
          renderCells={(item) => (
            <>
              <td className="py-2">{item.name}</td>
              <td className="py-2">{item.sku}</td>
              <td className="py-2">{item.category?.name}</td>
              <td className="py-2">{item.brand?.name}</td>
              <td className="py-2">{item.minStock}</td>
              <td className="py-2">{item.variations?.reduce((acc, v) => acc + v.stock, 0)}</td>
              <td className="py-2">{formatCurrencyBRL(item.price)}</td>
              <td className="py-2">
                <Button variant="secondary" className="mr-2 px-2 py-1 text-xs" onClick={() => startEdit(item)}>
                  Editar
                </Button>
                <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => removeProduct(item.id)}>
                  Excluir
                </Button>
              </td>
            </>
          )}
        />
      </SectionCard>
    </div>
  );
}
