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

function newDraftRow() {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    size: "",
    color: "",
    stock: "",
    sku: ""
  };
}

function collectDraftVariations(rows) {
  const filled = (rows || []).filter(draftRowHasInput);
  const accepted = [];
  for (const row of filled) {
    const message = validateDraftVariation(row, accepted);
    if (message) return { error: message };
    const parsed = normalizeDraftVariation(row);
    accepted.push({
      size: parsed.size,
      color: parsed.color,
      stock: parsed.stock,
      sku: parsed.sku
    });
  }
  if (accepted.length === 0) {
    return { error: "Preencha pelo menos um tamanho e uma cor." };
  }
  return { rows: accepted };
}

function draftRowHasInput(row) {
  return (
    String(row?.size || "").trim() !== "" ||
    String(row?.color || "").trim() !== "" ||
    String(row?.stock ?? "").trim() !== "" ||
    String(row?.sku || "").trim() !== ""
  );
}

function variationIdentity(row) {
  return `${String(row.size || "").trim().toLocaleLowerCase("pt-BR")}|${String(row.color || "").trim().toLocaleLowerCase("pt-BR")}`;
}

function normalizeDraftVariation(row) {
  const stockText = String(row.stock ?? "").trim();
  return {
    size: String(row.size || "").trim(),
    color: String(row.color || "").trim(),
    sku: String(row.sku || "").trim(),
    stockText,
    stock: Number(stockText)
  };
}

function validateDraftVariation(row, existing) {
  const parsed = normalizeDraftVariation(row);
  if (!parsed.size || !parsed.color) {
    return "Informe tamanho e cor juntos.";
  }
  if (parsed.stockText === "" || !Number.isInteger(parsed.stock) || parsed.stock < 0) {
    return "Informe a quantidade em estoque (número inteiro, 0 ou mais).";
  }
  if (existing.some((item) => variationIdentity(item) === variationIdentity(parsed))) {
    return "Esse tamanho e essa cor já estão na lista.";
  }
  const skuKey = parsed.sku.toLocaleLowerCase("pt-BR");
  if (skuKey && existing.some((item) => String(item.sku || "").trim().toLocaleLowerCase("pt-BR") === skuKey)) {
    return "Esse código de etiqueta já está em outra combinação.";
  }
  return "";
}

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
  const [draftVariations, setDraftVariations] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

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

    let variationsToCreate = [];
    if (!editingId && hasVariations) {
      const collected = collectDraftVariations(draftVariations);
      if (collected.error) {
        setError(collected.error);
        return;
      }
      variationsToCreate = collected.rows;
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
      if (!editingId && hasVariations && productId) {
        try {
          for (const row of variationsToCreate) {
            await apiClient("/product-variations", {
              method: "POST",
              token,
              body: {
                productId,
                size: row.size,
                color: row.color,
                stock: row.stock,
                sku: row.sku || null
              }
            });
          }
        } catch (variationErr) {
          const full = await apiClient(`/products/${productId}`, { token });
          patchProductInListCaches(full);
          await refreshProducts();
          startEdit(full);
          setHasVariations(true);
          const detail = variationErr?.message || "Não foi possível salvar uma combinação.";
          setError(`O produto foi salvo, mas uma combinação falhou: ${detail} Inclua de novo na lista abaixo.`);
          showToast("Produto criado. Falta concluir tamanho e cor.", "error");
          return;
        }
      } else if (productId && !hasVariations) {
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
        showToast(hasVariations ? "Produto criado com tamanhos e cores." : "Produto criado.");
        await refreshProducts();
        resetForm();
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
    setDraftVariations([]);
    setShowDetails(false);
    setScannerSku("");
  }

  function updateDraftRow(id, patch) {
    setDraftVariations((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addDraftRow() {
    setDraftVariations((prev) => [...prev, newDraftRow()]);
  }

  function removeDraftRow(id) {
    setDraftVariations((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length ? next : [newDraftRow()];
    });
  }

  function onDraftRowKeyDown(event) {
    if (event.key === "Enter") event.preventDefault();
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
    setDraftVariations([]);
    setShowDetails(true);
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
    if (checked) {
      setCurrentStockPreview("");
      if (!editingId) {
        setDraftVariations((prev) => (prev.length ? prev : [newDraftRow()]));
      }
      return;
    }
    setDraftVariations([]);
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Produtos"
        description="Nome, preço e quantidade. Se a peça tem tamanho ou cor, preencha as linhas e salve uma vez."
      />
      <ModuleNav items={catalogModuleItems()} label="Catálogo" />

      {isAdmin ? (
      <SectionCard title={editingId ? "Editar produto" : "Novo produto"}>
        <form className="mt-3 space-y-6" onSubmit={createProduct}>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">A peça</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs font-medium text-slate-600">Nome</span>
                <Input
                  placeholder="Nome"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Preço de venda</span>
                <CurrencyInput
                  placeholder="Preco"
                  value={form.price}
                  onChange={(price) => setForm((prev) => ({ ...prev, price }))}
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
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Estoque</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${
                  hasVariations ? "border-slate-200 bg-white" : "border-slate-900 bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="stockMode"
                  className="mt-1"
                  checked={!hasVariations}
                  onChange={() => onToggleVariations(false)}
                />
                <span>
                  <span className="text-sm font-medium text-slate-800">Peça única</span>
                  <span className="mt-0.5 block text-xs text-slate-500">Uma quantidade, sem tamanho nem cor.</span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${
                  hasVariations ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="stockMode"
                  className="mt-1"
                  checked={hasVariations}
                  onChange={() => onToggleVariations(true)}
                />
                <span>
                  <span className="text-sm font-medium text-slate-800">Tamanhos e cores</span>
                  <span className="mt-0.5 block text-xs text-slate-500">Uma linha para cada combinação.</span>
                </span>
              </label>
            </div>
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
            ) : editingId ? (
              <p className="text-xs text-slate-500">Cada tamanho e cor fica na lista abaixo deste formulário.</p>
            ) : (
              <div className="space-y-2">
                {draftVariations.map((row, index) => (
                  <div key={row.id} className="grid gap-2 md:grid-cols-[1fr_1fr_7rem_auto] md:items-end">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">{index === 0 ? "Tamanho" : ""}</span>
                      <Input
                        placeholder="P, M, 38..."
                        aria-label={`Tamanho ${index + 1}`}
                        value={row.size}
                        onChange={(e) => updateDraftRow(row.id, { size: e.target.value })}
                        onKeyDown={onDraftRowKeyDown}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">{index === 0 ? "Cor" : ""}</span>
                      <Input
                        placeholder="Preto, azul..."
                        aria-label={`Cor ${index + 1}`}
                        value={row.color}
                        onChange={(e) => updateDraftRow(row.id, { color: e.target.value })}
                        onKeyDown={onDraftRowKeyDown}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">{index === 0 ? "Quantidade" : ""}</span>
                      <Input
                        placeholder="0"
                        aria-label={`Quantidade ${index + 1}`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={row.stock}
                        onChange={(e) => updateDraftRow(row.id, { stock: e.target.value })}
                        onKeyDown={onDraftRowKeyDown}
                      />
                    </label>
                    <Button type="button" variant="secondary" className="md:mb-0.5" onClick={() => removeDraftRow(row.id)}>
                      Tirar
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={addDraftRow}>
                  Adicionar outra linha
                </Button>
              </div>
            )}
          </section>

          <div>
            <Button type="button" variant="secondary" onClick={() => setShowDetails((open) => !open)}>
              {showDetails ? "Ocultar custo, descrição e código" : "Custo, descrição e código de barras"}
            </Button>
          </div>

          {showDetails ? (
            <>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Detalhes</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Custo</span>
                    <CurrencyInput
                      placeholder="Custo"
                      value={form.cost}
                      onChange={(cost) => setForm((prev) => ({ ...prev, cost }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Avisar quando faltar</span>
                    <Input
                      placeholder="Quantidade minima"
                      type="number"
                      min="0"
                      value={form.minStock}
                      onChange={(e) => setForm((prev) => ({ ...prev, minStock: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs font-medium text-slate-600">Descrição</span>
                    <Textarea
                      placeholder="Descricao"
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Código de barras</span>
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
            </>
          ) : null}

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

      {isAdmin && hasVariations && editingId ? (
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
