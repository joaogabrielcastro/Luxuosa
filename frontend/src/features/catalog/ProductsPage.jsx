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
import { Sheet } from "../../shared/components/ui/Modal.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { FormField } from "../../shared/components/ui/FormField.jsx";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Input } from "../../shared/components/ui/Input.jsx";
import { CurrencyInput } from "../../shared/components/ui/CurrencyInput.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Textarea } from "../../shared/components/ui/Textarea.jsx";
import { Button, IconButton } from "../../shared/components/ui/Button.jsx";
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
  const { token, user, tenant } = useAuth();
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
  const [formOpen, setFormOpen] = useState(false);

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
        setFormOpen(false);
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

  function openNew() {
    resetForm();
    setError("");
    setFormOpen(true);
  }

  function openEdit(item) {
    setError("");
    startEdit(item);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    resetForm();
    setError("");
  }

  const priceNum = parseCurrencyInput(form.price);
  const costNum = parseCurrencyInput(form.cost);
  const marginPct = priceNum > 0 && costNum > 0 ? ((priceNum - costNum) / priceNum) * 100 : null;

  function stockBadge(item) {
    const current = productCurrentStock(item);
    const min = Number(item.minStock ?? 0);
    if (current === 0) return <Badge variant="danger" dot><span className="num">0</span></Badge>;
    if (min > 0 && current <= min) return <Badge variant="warning" dot><span className="num">{current}</span></Badge>;
    return <span className="num font-medium text-slate-900">{current}</span>;
  }

  function gridSummary(item) {
    const real = (item.variations || []).filter((v) => !isDefaultVariation(v));
    if (!real.length) return <span className="text-xs text-slate-400">Peça única</span>;
    const sizes = [...new Set(real.map((v) => String(v.size || "").trim()).filter(Boolean))];
    const colors = [...new Set(real.map((v) => String(v.color || "").trim()).filter(Boolean))];
    return (
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1">
          {sizes.slice(0, 6).map((sz) => (
            <span key={sz} className="rounded border border-slate-200 px-1.5 py-0.5 text-2xs font-medium text-slate-600">
              {sz}
            </span>
          ))}
          {sizes.length > 6 ? <span className="text-2xs text-slate-400">+{sizes.length - 6}</span> : null}
        </div>
        <p className="mt-1 truncate text-2xs text-slate-500">
          {colors.length} {colors.length === 1 ? "cor" : "cores"} · {real.length} combinações
        </p>
      </div>
    );
  }

  const lowOnPage = products.filter((p) => Number(p.minStock || 0) > 0 && productCurrentStock(p) <= Number(p.minStock || 0)).length;

  return (
    <div className="ui-page">
      <PageHeader
        title="Produtos"
        description="Encontre, cadastre e atualize suas peças com tamanhos, cores, preço e estoque."
        actions={
          isAdmin ? (
            <Button icon={Plus} onClick={openNew}>
              Novo produto
            </Button>
          ) : null
        }
      />
      <ModuleNav items={catalogModuleItems(tenant?.creditEventOnly === true)} label="Catálogo" />

      {!isAdmin ? (
        <Alert variant="info">Consulta de produtos. Somente administradores cadastram ou editam.</Alert>
      ) : null}
      {error && !formOpen ? <FormErrorSummary error={error} className="" /> : null}

      <DataTable
        data={products}
        loading={listLoading}
        columns={[
          { key: "name", label: "Produto" },
          { key: "grid", label: "Grade" },
          { key: "stock", label: "Estoque", className: "text-right" },
          { key: "price", label: "Preço", className: "text-right" },
          ...(isAdmin ? [{ key: "actions", label: <span className="sr-only">Ações</span>, className: "w-24" }] : [])
        ]}
        getRowKey={(row) => row.id}
        onRowClick={isAdmin ? openEdit : undefined}
        emptyTitle={query || categoryFilter || brandFilter ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
        emptyMessage={query || categoryFilter || brandFilter ? "Ajuste a busca ou os filtros." : "Cadastre a primeira peça para começar a vender."}
        emptyActions={isAdmin && !query ? <Button size="sm" icon={Plus} onClick={openNew}>Novo produto</Button> : null}
        serverPagination={{ skip: productSkip, take: productTake, total: totalProducts, onChange: setProductSkip }}
        search={{ query, onQueryChange: setQuery, placeholder: "Buscar por nome ou código" }}
        toolbar={lowOnPage ? <Badge variant="warning" dot>{lowOnPage} com estoque baixo nesta página</Badge> : null}
        filters={[
          {
            id: "category",
            label: "Categoria",
            value: categoryFilter,
            onChange: (v) => {
              setCategoryFilter(v);
              setBrandFilter("");
            },
            options: [{ value: "", label: "Todas as categorias" }, ...categories.map((item) => ({ value: item.id, label: item.name }))]
          },
          {
            id: "brand",
            label: "Marca",
            value: brandFilter,
            onChange: setBrandFilter,
            options: [{ value: "", label: "Todas as marcas" }, ...brands.map((item) => ({ value: item.id, label: item.name }))]
          }
        ]}
        renderCells={(item) => (
          <>
            <td>
              <p className="font-medium text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-500">
                {[item.sku?.trim() || null, item.category?.name, item.brand?.name].filter(Boolean).join(" · ")}
              </p>
            </td>
            <td className="max-w-[16rem]">{gridSummary(item)}</td>
            <td className="text-right">
              {stockBadge(item)}
              {Number(item.minStock) > 0 ? <p className="num text-2xs text-slate-400">mín. {item.minStock}</p> : null}
            </td>
            <td className="num whitespace-nowrap text-right font-medium text-slate-900">{formatCurrencyBRL(item.price)}</td>
            {isAdmin ? (
              <td onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <IconButton icon={Pencil} label="Editar" size="sm" onClick={() => openEdit(item)} />
                  <IconButton icon={Trash2} label="Excluir" size="sm" className="hover:bg-red-50 hover:text-red-600" onClick={() => removeProduct(item.id)} />
                </div>
              </td>
            ) : null}
          </>
        )}
        renderMobileCard={(item) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{item.name}</p>
              <p className="truncate text-xs text-slate-500">{[item.sku, item.brand?.name].filter(Boolean).join(" · ")}</p>
              <div className="mt-1.5">{gridSummary(item)}</div>
            </div>
            <div className="shrink-0 text-right">
              <p className="num font-semibold text-slate-900">{formatCurrencyBRL(item.price)}</p>
              <div className="mt-1">{stockBadge(item)}</div>
            </div>
          </div>
        )}
      />

      <Sheet
        open={isAdmin && formOpen}
        onClose={closeForm}
        title={editingId ? "Editar produto" : "Novo produto"}
        description={editingId ? form.name : "Preencha o essencial; o restante pode ser ajustado depois."}
        width="max-w-2xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeForm}>
              {editingId ? "Fechar" : "Cancelar"}
            </Button>
            <Button type="submit" form="product-form" loading={loading}>
              {editingId ? "Atualizar produto" : "Salvar produto"}
            </Button>
          </>
        }
      >
        <form id="product-form" className="space-y-6" onSubmit={createProduct}>
          <section className="space-y-3">
            <h3 className="ui-eyebrow">A peça</h3>
            <FormField label="Nome" htmlFor="product-name" required>
              <Input
                id="product-name"
                placeholder="Nome"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Categoria" required>
                <Select value={form.categoryId} onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}>
                  <option value="">Selecione categoria</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Marca" required>
                <Select value={form.brandId} onChange={(e) => setForm((prev) => ({ ...prev, brandId: e.target.value }))}>
                  <option value="">Selecione marca</option>
                  {brands.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="ui-eyebrow">Preço</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Preço de venda" required>
                <CurrencyInput placeholder="Preco" value={form.price} onChange={(price) => setForm((prev) => ({ ...prev, price }))} />
              </FormField>
              <FormField label="Custo" hint="Usado no cálculo de lucro.">
                <CurrencyInput placeholder="Custo" value={form.cost} onChange={(cost) => setForm((prev) => ({ ...prev, cost }))} />
              </FormField>
              <div className="flex flex-col justify-center rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-500">Margem</span>
                <span className={`num text-lg font-semibold ${marginPct !== null && marginPct < 0 ? "text-red-700" : "text-slate-900"}`}>
                  {marginPct === null ? "—" : `${marginPct.toFixed(0)}%`}
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="ui-eyebrow">Estoque</h3>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de estoque">
              {[
                { value: false, title: "Peça única", text: "Uma quantidade, sem tamanho nem cor." },
                { value: true, title: "Tamanhos e cores", text: "Uma linha para cada combinação." }
              ].map((opt) => {
                const active = hasVariations === opt.value;
                return (
                  <label
                    key={String(opt.value)}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      active ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="stockMode"
                      className="mt-1 accent-[rgb(var(--brand-700))]"
                      checked={active}
                      onChange={() => onToggleVariations(opt.value)}
                    />
                    <span>
                      <span className="text-sm font-medium text-slate-900">{opt.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{opt.text}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {!hasVariations ? (
                <FormField label="Quantidade em estoque" hint={editingId ? "Para reduzir, use Estoque → Movimentações." : null}>
                  <Input
                    placeholder="Quantidade atual"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={currentStockPreview}
                    onChange={(e) => setCurrentStockPreview(e.target.value)}
                  />
                </FormField>
              ) : null}
              <FormField label="Avisar quando faltar" hint="Estoque mínimo do produto (soma da grade).">
                <Input
                  placeholder="Quantidade minima"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.minStock}
                  onChange={(e) => setForm((prev) => ({ ...prev, minStock: e.target.value }))}
                />
              </FormField>
            </div>
            {hasVariations && !editingId ? (
              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                {draftVariations.map((row, index) => (
                  <div key={row.id} className="grid grid-cols-[1fr_1fr_5.5rem_auto] items-end gap-2">
                    <label className="flex min-w-0 flex-col gap-1">
                      {index === 0 ? <span className="ui-label mb-0">Tamanho</span> : null}
                      <Input
                        placeholder="P, M, 38..."
                        aria-label={`Tamanho ${index + 1}`}
                        value={row.size}
                        onChange={(e) => updateDraftRow(row.id, { size: e.target.value })}
                        onKeyDown={onDraftRowKeyDown}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      {index === 0 ? <span className="ui-label mb-0">Cor</span> : null}
                      <Input
                        placeholder="Preto, azul..."
                        aria-label={`Cor ${index + 1}`}
                        value={row.color}
                        onChange={(e) => updateDraftRow(row.id, { color: e.target.value })}
                        onKeyDown={onDraftRowKeyDown}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      {index === 0 ? <span className="ui-label mb-0">Qtd.</span> : null}
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
                    <IconButton icon={X} label={`Tirar linha ${index + 1}`} onClick={() => removeDraftRow(row.id)} />
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={addDraftRow}>
                  Adicionar outra linha
                </Button>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setShowDetails((open) => !open)}
              aria-expanded={showDetails}
            >
              <span className="ui-eyebrow">Código de barras e descrição</span>
              <span className="text-xs font-medium text-brand-700">{showDetails ? "Ocultar" : "Mostrar"}</span>
            </button>
            {showDetails ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Código de barras / SKU">
                  <Input placeholder="SKU (opcional)" value={form.sku} onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))} />
                </FormField>
                <FormField label="Ler com o leitor">
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
                </FormField>
                <FormField label="Descrição" className="sm:col-span-2">
                  <Textarea placeholder="Descricao" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                </FormField>
              </div>
            ) : null}
          </section>
          <FormErrorSummary error={error} className="" />
        </form>

        {hasVariations && editingId ? (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <ProductVariationsSection
              embedded
              token={token}
              productId={editingId}
              productName={form.name?.trim() || ""}
              onChanged={() => refreshProducts().catch(() => {})}
            />
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
