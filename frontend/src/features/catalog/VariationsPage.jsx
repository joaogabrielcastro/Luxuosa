import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";

const EMPTY_VARIATION_FORM = { productId: "", size: "", color: "", stock: 0 };

export function VariationsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [variations, setVariations] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [variationSkip, setVariationSkip] = useState(0);
  const [totalVariations, setTotalVariations] = useState(0);
  const variationTake = 50;
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formBrandId, setFormBrandId] = useState("");
  const [form, setForm] = useState(EMPTY_VARIATION_FORM);
  const [stockUnits, setStockUnits] = useState([]);
  const [newUnitBarcode, setNewUnitBarcode] = useState("");
  const [newUnitNotes, setNewUnitNotes] = useState("");
  const [unitsLoading, setUnitsLoading] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === form.productId),
    [products, form.productId]
  );
  const trackByUnit = selectedProduct?.trackByUnit === true;

  async function load() {
    setListLoading(true);
    const params = new URLSearchParams();
    params.set("take", String(variationTake));
    params.set("skip", String(variationSkip));
    if (query.trim()) params.set("q", query.trim());
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (brandFilter) params.set("brandId", brandFilter);
    if (productFilter) params.set("productId", productFilter);
    const [categoriesData, brandsData, productsData, variationsData] = await Promise.all([
      apiClient("/categories", { token }),
      apiClient("/brands", { token }),
      apiClient("/products", { token }),
      apiClient(`/product-variations?${params.toString()}`, { token })
    ]);
    setCategories(categoriesData);
    setBrands(brandsData);
    setProducts(productsData);
    setVariations(variationsData.items || []);
    setTotalVariations(Number(variationsData.total || 0));
    setListLoading(false);
  }

  useEffect(() => {
    load().catch((err) => {
      setListLoading(false);
      setError(err.message);
    });
  }, [variationSkip, token, query, categoryFilter, brandFilter, productFilter]);

  useEffect(() => {
    setVariationSkip(0);
  }, [query, categoryFilter, brandFilter, productFilter]);

  async function loadStockUnits(variationId) {
    if (!variationId || !trackByUnit) {
      setStockUnits([]);
      return;
    }
    setUnitsLoading(true);
    try {
      const data = await apiClient(`/stock-units?productVariationId=${encodeURIComponent(variationId)}`, { token });
      setStockUnits(Array.isArray(data) ? data : []);
    } catch {
      setStockUnits([]);
    } finally {
      setUnitsLoading(false);
    }
  }

  useEffect(() => {
    if (editingId && trackByUnit) {
      loadStockUnits(editingId).catch(() => setStockUnits([]));
    } else {
      setStockUnits([]);
    }
  }, [editingId, trackByUnit, token]);

  async function addStockUnit(e) {
    e.preventDefault();
    if (!editingId || !newUnitBarcode.trim()) return;
    setError("");
    setLoading(true);
    try {
      await apiClient("/stock-units", {
        method: "POST",
        token,
        body: {
          productVariationId: editingId,
          barcode: newUnitBarcode.trim(),
          notes: newUnitNotes.trim() || undefined
        }
      });
      setNewUnitBarcode("");
      setNewUnitNotes("");
      showToast("Codigo cadastrado.");
      await loadStockUnits(editingId);
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function removeStockUnit(unitId) {
    try {
      const confirmed = await confirm({
        title: "Remover codigo",
        message: "Remover esta unidade do estoque disponivel?",
        confirmText: "Remover"
      });
      if (!confirmed) return;
      await apiClient(`/stock-units/${unitId}`, { method: "DELETE", token });
      showToast("Unidade removida.");
      if (editingId) await loadStockUnits(editingId);
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  async function createVariation(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient(editingId ? `/product-variations/${editingId}` : "/product-variations", {
        method: editingId ? "PUT" : "POST",
        token,
        body: {
          ...form,
          stock: trackByUnit ? 0 : Number(form.stock)
        }
      });
      showToast(editingId ? "Variacao atualizada." : "Variacao criada.");
      setEditingId("");
      setFormCategoryId("");
      setFormBrandId("");
      setForm(EMPTY_VARIATION_FORM);
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
        message:
          "Excluir esta variacao? So e possivel se nao houver vendas/crediario; o historico de movimentos de estoque desta variacao sera apagado.",
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
    setFormBrandId(item.product?.brandId || "");
    setForm({
      productId: item.productId || "",
      size: item.size || "",
      color: item.color || "",
      stock: Number(item.stock || 0)
    });
  }

  const sortedBrands = useMemo(
    () => [...brands].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [brands]
  );

  const brandIdsInFormCategory = useMemo(() => {
    if (!formCategoryId) return new Set();
    const ids = new Set();
    for (const p of products) {
      if (p.categoryId === formCategoryId) ids.add(p.brandId);
    }
    return ids;
  }, [products, formCategoryId]);

  const brandOptionsForForm = sortedBrands.filter((b) => brandIdsInFormCategory.has(b.id));

  const productsByCategoryAndBrand = products.filter(
    (item) =>
      (!formCategoryId || item.categoryId === formCategoryId) &&
      (!formBrandId || item.brandId === formBrandId)
  );

  const productsForListFilter = products.filter(
    (item) =>
      (!categoryFilter || item.categoryId === categoryFilter) &&
      (!brandFilter || item.brandId === brandFilter)
  );

  return (
    <div className="ui-page">
      <PageHeader title="Variacoes" description="Controle tamanho, cor e estoque por item." />
      <SectionCard title={editingId ? "Editar variacao" : "Nova variacao"}>
        <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={createVariation}>
          <Select
            value={formCategoryId}
            onChange={(e) => {
              const nextCategoryId = e.target.value;
              setFormCategoryId(nextCategoryId);
              setFormBrandId("");
              setForm((prev) => ({ ...prev, productId: "" }));
            }}
          >
            <option value="">Selecione categoria</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            value={formBrandId}
            disabled={!formCategoryId}
            onChange={(e) => {
              setFormBrandId(e.target.value);
              setForm((prev) => ({ ...prev, productId: "" }));
            }}
          >
            <option value="">{formCategoryId ? "Selecione marca" : "Primeiro a categoria"}</option>
            {brandOptionsForForm.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            className="md:col-span-2"
            value={form.productId}
            disabled={!formCategoryId || !formBrandId}
            onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
          >
            <option value="">
              {!formCategoryId
                ? "Primeiro selecione a categoria"
                : !formBrandId
                  ? "Selecione a marca"
                  : "Selecione produto"}
            </option>
            {productsByCategoryAndBrand.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.sku})
              </option>
            ))}
          </Select>
          <Input
            placeholder="Tamanho"
            value={form.size}
            onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))}
          />
          <Input
            placeholder="Cor"
            value={form.color}
            onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
          />
          <Input
            className="md:col-span-2"
            placeholder={trackByUnit ? "Estoque (calculado pelos codigos)" : "Estoque"}
            type="number"
            value={form.stock}
            disabled={trackByUnit}
            onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
          />
          {trackByUnit ? (
            <p className="md:col-span-2 text-xs text-slate-600">
              Com &quot;rastrear por peca&quot; no produto, cadastre cada codigo abaixo apos salvar a variacao.
            </p>
          ) : null}
          <div className="flex gap-2 md:col-span-2">
            <Button disabled={loading}>
              {editingId ? "Atualizar variacao" : "Salvar variacao"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingId("");
                  setFormCategoryId("");
                  setFormBrandId("");
                  setForm(EMPTY_VARIATION_FORM);
                }}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <Alert className="mt-2" variant="danger">{error}</Alert> : null}
      </SectionCard>

      {editingId && trackByUnit ? (
        <SectionCard title="Codigos de barras desta variacao">
          <p className="text-xs text-slate-600">
            Cada linha e uma peca fisica. O estoque da variacao e a quantidade de codigos disponiveis.
          </p>
          <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={addStockUnit}>
            <Input
              placeholder="Codigo de barras"
              value={newUnitBarcode}
              onChange={(e) => setNewUnitBarcode(e.target.value)}
            />
            <Input
              className="sm:flex-1"
              placeholder="Observacao (opcional)"
              value={newUnitNotes}
              onChange={(e) => setNewUnitNotes(e.target.value)}
            />
            <Button type="submit" disabled={loading || !newUnitBarcode.trim()}>
              Adicionar
            </Button>
          </form>
          <div className="mt-3 rounded border border-slate-200">
            {unitsLoading ? (
              <p className="p-3 text-xs text-slate-500">Carregando...</p>
            ) : stockUnits.length === 0 ? (
              <p className="p-3 text-xs text-slate-500">Nenhum codigo cadastrado.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {stockUnits.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="font-mono text-xs">{u.barcode}</span>
                    <span className="text-xs text-slate-500">{u.status}</span>
                    {u.status === "AVAILABLE" ? (
                      <Button type="button" variant="danger" className="px-2 py-0.5 text-xs" onClick={() => removeStockUnit(u.id)}>
                        Remover
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Lista de variacoes">
      <DataTable
        data={variations}
        columns={[
          { key: "product", label: "Produto" },
          { key: "brand", label: "Marca" },
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
          matcher: () => true
        }}
        filters={[
          {
            id: "category",
            value: categoryFilter,
            onChange: (value) => {
              setCategoryFilter(value);
              setBrandFilter("");
              setProductFilter("");
            },
            options: [{ value: "", label: "Todas as categorias" }, ...categories.map((item) => ({ value: item.id, label: item.name }))],
            matcher: () => true
          },
          {
            id: "brand",
            value: brandFilter,
            onChange: (value) => {
              setBrandFilter(value);
              setProductFilter("");
            },
            options: [
              { value: "", label: "Todas as marcas" },
              ...sortedBrands
                .filter((b) => products.some((p) => p.brandId === b.id && (!categoryFilter || p.categoryId === categoryFilter)))
                .map((item) => ({ value: item.id, label: item.name }))
            ],
            matcher: () => true
          },
          {
            id: "product",
            value: productFilter,
            onChange: setProductFilter,
            options: [{ value: "", label: "Todos os produtos" }, ...productsForListFilter.map((item) => ({ value: item.id, label: item.name }))],
            matcher: () => true
          }
        ]}
        renderCells={(item) => (
          <>
            <td className="py-2">{item.product?.name}</td>
            <td className="py-2">{item.product?.brand?.name}</td>
            <td className="py-2">{item.size}</td>
            <td className="py-2">{item.color}</td>
            <td className="py-2">
              {item.stock}
              {item.product?.trackByUnit ? (
                <span className="ml-1 text-[10px] text-violet-700" title="Estoque por codigo">
                  (peca)
                </span>
              ) : null}
            </td>
            <td className="py-2">
              <Button variant="secondary" className="mr-2 px-2 py-1 text-xs" onClick={() => startEdit(item)}>
                Editar
              </Button>
              <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => removeVariation(item.id)}>
                Excluir
              </Button>
            </td>
          </>
        )}
      />
      </SectionCard>
      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
        <span>{listLoading ? "Carregando..." : `Mostrando ${variations.length} de ${totalVariations} variacoes`}</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="px-2 py-1 text-xs"
            disabled={variationSkip === 0 || listLoading}
            onClick={() => setVariationSkip((v) => Math.max(v - variationTake, 0))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="px-2 py-1 text-xs"
            disabled={variationSkip + variationTake >= totalVariations || listLoading}
            onClick={() => setVariationSkip((v) => v + variationTake)}
          >
            Proxima
          </Button>
        </div>
      </div>
    </div>
  );
}
