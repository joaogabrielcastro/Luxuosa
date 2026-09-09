import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../shared/apiClient.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { useCatalogTaxonomies } from "../../shared/hooks/useCatalogTaxonomies.js";
import { useInvalidateLuxuosa } from "../../shared/hooks/useInvalidateLuxuosa.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { amountToCurrencyInput, formatCurrencyBRL, parseCurrencyInput } from "../../shared/formatters.js";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { CurrencyInput } from "../../shared/components/ui/CurrencyInput.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Textarea } from "../../shared/components/ui/Textarea.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { FormErrorSummary } from "../../shared/components/FormErrorSummary.jsx";
import { ModuleNav } from "../../shared/components/ModuleNav.jsx";
import { catalogModuleItems } from "../../shared/navConfig.js";
import { ProductVariationsSection } from "./ProductVariationsSection.jsx";
import { isDefaultVariation } from "./catalogConstants.js";

function productCurrentStock(item) {
  return (item.variations || []).reduce((acc, v) => acc + Number(v.stock || 0), 0);
}

function productHasRealVariations(item) {
  return (item.variations || []).some((v) => !isDefaultVariation(v));
}

function productLowStockClass(item) {
  const min = Number(item.minStock ?? 0);
  if (min <= 0) return "";
  const current = productCurrentStock(item);
  if (current > min) return "";
  if (current === 0) {
    return "border-l-4 border-l-rose-500 bg-rose-50/90 hover:bg-rose-50";
  }
  return "border-l-4 border-l-amber-500 bg-amber-50/80 hover:bg-amber-50/90";
}

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

function buildProductPayload(form) {
  const skuTrim = String(form.sku || "").trim();
  return {
    name: String(form.name || "").trim(),
    description: String(form.description || "").trim() || undefined,
    categoryId: form.categoryId,
    brandId: form.brandId,
    sku: skuTrim === "" ? null : skuTrim,
    price: parseCurrencyInput(form.price),
    cost: parseCurrencyInput(form.cost),
    minStock: Number(form.minStock || 0)
  };
}

export function ProductsPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const { invalidateProducts, invalidateCatalog } = useInvalidateLuxuosa(token);
  const { categories, brands } = useCatalogTaxonomies(token);
  const [productSkip, setProductSkip] = useState(0);
  const productTake = 50;
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [error, setError] = useState("");
  const [scannerSku, setScannerSku] = useState("");
  const [form, setForm] = useState(EMPTY_PRODUCT_FORM);
  const [currentStockPreview, setCurrentStockPreview] = useState("");
  const [hasVariations, setHasVariations] = useState(false);

  const listParams = useMemo(
    () => ({
      take: productTake,
      skip: productSkip,
      q: query.trim(),
      categoryId: categoryFilter,
      brandId: brandFilter
    }),
    [productTake, productSkip, query, categoryFilter, brandFilter]
  );

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(token, listParams),
    enabled: Boolean(token),
    staleTime: 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("take", String(productTake));
      params.set("skip", String(productSkip));
      if (listParams.q) params.set("q", listParams.q);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (brandFilter) params.set("brandId", brandFilter);
      return apiClient(`/products?${params.toString()}`, { token });
    }
  });

  const products = productsQuery.data?.items ?? [];
  const totalProducts = Number(productsQuery.data?.total ?? 0);
  const listLoading = productsQuery.isLoading || productsQuery.isFetching;

  useEffect(() => {
    if (productsQuery.error) setError(productsQuery.error);
  }, [productsQuery.error]);

  useEffect(() => {
    setProductSkip(0);
  }, [query, categoryFilter, brandFilter]);

  function patchProductInListCaches(product) {
    if (!product?.id) return;
    queryClient.setQueriesData({ queryKey: queryKeys.products.all(token) }, (cached) => {
      if (!cached?.items) return cached;
      return {
        ...cached,
        items: cached.items.map((row) => (row.id === product.id ? { ...row, ...product } : row))
      };
    });
  }

  async function refreshProducts() {
    await Promise.all([invalidateProducts(), invalidateCatalog()]);
  }

  /** Ajusta só a variação padrão (sem tamanho/cor). Variações reais ficam na seção abaixo. */
  async function syncDefaultStock(productId, desiredStock) {
    const product = await apiClient(`/products/${productId}`, { token });
    const variations = product.variations || [];
    const defaultVariation = variations.find(isDefaultVariation);
    const desired = Number(desiredStock || 0);
    const current = variations.reduce((acc, v) => acc + Number(v.stock || 0), 0);
    if (desired === current) return;

    if (desired > current) {
      const increment = desired - current;
      if (defaultVariation) {
        await apiClient(`/product-variations/${defaultVariation.id}`, {
          method: "PUT",
          token,
          body: { stock: Number(defaultVariation.stock) + increment }
        });
      } else {
        await apiClient("/product-variations", {
          method: "POST",
          token,
          body: { productId, size: "", color: "", stock: increment }
        });
      }
      return;
    }

    const decrement = current - desired;
    if (!defaultVariation || Number(defaultVariation.stock) < decrement) {
      throw new Error("Para reduzir o estoque deste produto, use Estoque → Movimentações.");
    }

    await apiClient(`/product-variations/${defaultVariation.id}`, {
      method: "PUT",
      token,
      body: { stock: Number(defaultVariation.stock) - decrement }
    });
  }

  async function createProduct(event) {
    event.preventDefault();
    if (!isAdmin) return;
    setError("");
    if (!token) {
      setError("Sessao expirada. Faca login novamente.");
      return;
    }
    if (!form.categoryId || !form.brandId) {
      setError("Selecione categoria e marca antes de salvar o produto.");
      return;
    }
    setLoading(true);
    try {
      const payload = buildProductPayload(form);
      const response = await apiClient(editingId ? `/products/${editingId}` : "/products", {
        method: editingId ? "PUT" : "POST",
        token,
        body: payload
      });
      const productId = editingId || response?.id;
      if (productId && !hasVariations) {
        const skipStockAdjust = Boolean(editingId) && currentStockPreview === "";
        if (!skipStockAdjust) {
          await syncDefaultStock(productId, currentStockPreview);
        }
      }

      if (editingId) {
        showToast("Produto atualizado.");
        const full = await apiClient(`/products/${editingId}`, { token });
        patchProductInListCaches(full);
        await refreshProducts();
        startEdit(full);
      } else if (response?.id) {
        showToast("Produto criado.");
        const full = await apiClient(`/products/${response.id}`, { token });
        patchProductInListCaches(full);
        await refreshProducts();
        startEdit(full);
      } else {
        await refreshProducts();
      }
    } catch (err) {
      setError(err);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function removeProduct(id) {
    if (!isAdmin) return;
    try {
      const confirmed = await confirm({
        title: "Excluir produto",
        message:
          "Excluir este produto e todas as variacoes? So e possivel se nao houver vendas/crediario vinculados e se os movimentos de estoque puderem ser removidos.",
        confirmText: "Excluir"
      });
      if (!confirmed) return;
      await apiClient(`/products/${id}`, { method: "DELETE", token });
      if (id === editingId) {
        resetForm();
      }
      await refreshProducts();
      showToast("Produto excluido.");
    } catch (err) {
      setError(err);
      showToast(err.message, "error");
    }
  }

  function resetForm() {
    setEditingId("");
    setForm(EMPTY_PRODUCT_FORM);
    setCurrentStockPreview("");
    setHasVariations(false);
    setScannerSku("");
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      description: item.description || "",
      price: amountToCurrencyInput(item.price),
      cost: amountToCurrencyInput(item.cost),
      categoryId: item.categoryId || "",
      brandId: item.brandId || "",
      sku: item.sku || "",
      minStock: Number(item.minStock || 0)
    });
    const withVars = productHasRealVariations(item);
    setHasVariations(withVars);
    if (withVars) {
      setCurrentStockPreview("");
    } else {
      const vars = item.variations || [];
      const stockSum = productCurrentStock(item);
      const only = vars.length === 1 ? vars[0] : null;
      setCurrentStockPreview(only ? String(Number(only.stock ?? 0)) : stockSum > 0 ? String(stockSum) : "");
    }
  }

  function applyScannedSku() {
    const normalized = String(scannerSku || "").trim();
    if (!normalized) return;
    setForm((prev) => ({ ...prev, sku: normalized }));
    setScannerSku("");
    showToast("Codigo lido e aplicado no codigo de barras.");
  }

  function onToggleVariations(checked) {
    if (!checked && editingId) {
      const current = products.find((p) => p.id === editingId);
      if (current && productHasRealVariations(current)) {
        showToast("Este produto já tem tamanhos ou cores. Remova-os na lista abaixo para voltar a um único estoque.", "error");
        return;
      }
    }
    setHasVariations(checked);
    if (checked) setCurrentStockPreview("");
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Produtos"
        description="Cadastre peças da loja: dados, preço, tamanhos e cores, estoque e código de barras."
      />
      <ModuleNav items={catalogModuleItems()} label="Catálogo" />

      {isAdmin ? (
      <SectionCard title={editingId ? "Editar produto" : "Novo produto"}>
        <form className="mt-3 space-y-8" onSubmit={createProduct}>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Produto</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Nome</span>
                <Input
                  placeholder="Nome"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Categoria</span>
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
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Marca</span>
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
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs font-medium text-slate-600">Descrição</span>
                <Textarea
                  placeholder="Descricao"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Preço</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Preço de venda</span>
                <CurrencyInput
                  placeholder="Preco"
                  value={form.price}
                  onChange={(price) => setForm((prev) => ({ ...prev, price }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Custo</span>
                <CurrencyInput
                  placeholder="Custo"
                  value={form.cost}
                  onChange={(cost) => setForm((prev) => ({ ...prev, cost }))}
                />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Variações</h3>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={hasVariations}
                onChange={(e) => onToggleVariations(e.target.checked)}
              />
              <span>
                <span className="text-sm font-medium text-slate-800">Este produto possui tamanhos ou cores</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Ative para camisetas, calças e peças com mais de uma combinação.
                </span>
              </span>
            </label>
            {!hasVariations ? (
              <label className="flex max-w-xs flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Quantidade em estoque</span>
                <Input
                  placeholder="Quantidade atual"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={currentStockPreview}
                  onChange={(e) => setCurrentStockPreview(e.target.value)}
                />
              </label>
            ) : (
              <p className="text-xs text-slate-500">
                {editingId
                  ? "Informe tamanho, cor e quantidade na tabela abaixo."
                  : "Salve o produto para cadastrar cada tamanho e cor."}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Estoque mínimo</h3>
            <label className="flex max-w-xs flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Avisar quando faltar</span>
              <Input
                placeholder="Quantidade minima"
                type="number"
                min="0"
                value={form.minStock}
                onChange={(e) => setForm((prev) => ({ ...prev, minStock: e.target.value }))}
              />
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Código de barras</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Código (SKU)</span>
                <Input
                  placeholder="SKU (opcional)"
                  value={form.sku}
                  onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Leitor</span>
                <div className="flex gap-2">
                  <Input
                    placeholder="Bipar e pressionar Enter"
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
                    Aplicar
                  </Button>
                </div>
              </label>
            </div>
          </section>

          <div className="flex gap-2">
            <Button disabled={loading}>
              {editingId ? "Atualizar produto" : "Salvar produto"}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
        <FormErrorSummary error={error} className="mt-2" />
      </SectionCard>
      ) : (
        <SectionCard title="Catálogo">
          <p className="text-sm text-slate-600">Consulta de produtos. Somente administradores cadastram ou editam.</p>
        </SectionCard>
      )}

      {isAdmin && hasVariations ? (
        <ProductVariationsSection
          token={token}
          productId={editingId}
          productName={form.name?.trim() || ""}
          onChanged={() => refreshProducts().catch(() => {})}
        />
      ) : null}

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
          getRowClassName={productLowStockClass}
          columns={[
            { key: "name", label: "Nome" },
            { key: "sku", label: "SKU" },
            { key: "category", label: "Categoria" },
            { key: "brand", label: "Marca" },
            { key: "stock", label: "Qtd atual" },
            { key: "min", label: "Mín" },
            { key: "price", label: "Preço" },
            { key: "actions", label: "Ações" }
          ]}
          getRowKey={(row) => row.id}
          emptyMessage="Nenhum produto encontrado. Cadastre o primeiro no formulário acima."
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
          renderCells={(item) => {
            const current = productCurrentStock(item);
            const min = Number(item.minStock ?? 0);
            const low = min > 0 && current <= min;
            const stockClass = low
              ? current === 0
                ? "font-semibold text-rose-700"
                : "font-semibold text-amber-800"
              : "";
            return (
            <>
              <td className="py-2">{item.name}</td>
              <td className="py-2">{item.sku?.trim() ? item.sku : "—"}</td>
              <td className="py-2">{item.category?.name}</td>
              <td className="py-2">{item.brand?.name}</td>
              <td className={`py-2 ${stockClass}`}>{current}</td>
              <td className="py-2">{item.minStock}</td>
              <td className="py-2">{formatCurrencyBRL(item.price)}</td>
              <td className="py-2">
                {isAdmin ? (
                  <>
                    <Button variant="secondary" className="mr-2 px-2 py-1 text-xs" onClick={() => startEdit(item)}>
                      Editar
                    </Button>
                    <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => removeProduct(item.id)}>
                      Excluir
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
            </>
            );
          }}
        />
      </SectionCard>
    </div>
  );
}
