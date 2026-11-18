import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronUp, History, ScanLine, Search, X } from "lucide-react";
import { useAuth } from "../../auth/useAuth.jsx";
import { apiClient } from "../../../shared/apiClient.js";
import { unwrapList } from "../../../shared/apiList.js";
import { queryKeys } from "../../../shared/queryKeys.js";
import { useToast } from "../../../shared/components/ToastProvider.jsx";
import { useInvalidateLuxuosa } from "../../../shared/hooks/useInvalidateLuxuosa.js";
import { Input } from "../../../shared/components/ui/Input.jsx";
import { Kbd } from "../../../shared/components/ui/Kbd.jsx";
import { Alert } from "../../../shared/components/ui/Alert.jsx";
import { Sheet } from "../../../shared/components/ui/Modal.jsx";
import { cn } from "../../../shared/components/ui/helpers.js";
import { formatCurrencyBRL } from "../../../shared/formatters.js";
import { getErrorPresentation } from "../../../shared/apiErrors.js";
import { CartPanel } from "./CartPanel.jsx";
import { ProductResults } from "./ProductResults.jsx";
import { SaleReceipt } from "./SaleReceipt.jsx";
import { SaleSuccessModal } from "./SaleSuccessModal.jsx";
import { VariantPicker } from "./VariantPicker.jsx";
import { usePosCart } from "./usePosCart.js";
import { exactCodeMatches, groupByProduct, computeChange } from "./posUtils.js";
import { fetchVariationsByCode, useVariationSearch } from "./useVariationSearch.js";

/**
 * PDV — Ponto de venda.
 * Busca/bipagem à esquerda, carrinho fixo à direita (tablet em pé e celular: gaveta inferior).
 */
export function PosPage() {
  const { token, tenant, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refreshAfterSaleMutation } = useInvalidateLuxuosa(token);
  const enableNfceEmission = tenant?.enableNfceEmission === true;
  const cart = usePosCart({ userType: user?.type, enableNfceEmission });

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [picker, setPicker] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const searchRef = useRef(null);

  const search = useVariationSearch(token, { query, categoryId });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.catalog.categories(token),
    enabled: Boolean(token),
    queryFn: () => apiClient("/categories", { token })
  });
  const categories = useMemo(
    () => [...unwrapList(categoriesQuery.data)].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [categoriesQuery.data]
  );

  const focusSearch = useCallback(() => {
    requestAnimationFrame(() => {
      searchRef.current?.focus();
      searchRef.current?.select?.();
    });
  }, []);

  // Edição de venda vinda do histórico: /vendas?editar=<id>
  const editId = params.get("editar");
  useEffect(() => {
    if (!editId || !token) return;
    let cancelled = false;
    apiClient(`/sales/${editId}`, { token })
      .then((sale) => {
        if (cancelled) return;
        cart.loadSale(sale);
        showToast("Venda carregada para edição.");
      })
      .catch((err) => showToast(err.message || "Não foi possível carregar a venda.", "error"))
      .finally(() => {
        if (!cancelled) setParams({}, { replace: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, token]);

  const notify = useCallback((message, type = "success") => showToast(message, type), [showToast]);

  const addVariation = useCallback(
    (variation) => {
      const res = cart.addVariation(variation);
      if (!res.ok) notify(res.message, "error");
      return res.ok;
    },
    [cart, notify]
  );

  const selectGroup = useCallback(
    (group) => {
      // Uma única combinação (ou produto sem grade): adiciona direto, sem abrir a grade.
      if (group.variations.length === 1) {
        if (addVariation(group.variations[0])) focusSearch();
        return;
      }
      setPicker(group);
    },
    [addVariation, focusSearch]
  );

  /** Enter na busca: leitura de código (etiqueta/SKU) ou único resultado. */
  const handleEnter = useCallback(async () => {
    const raw = query.trim();
    if (!raw) return;
    let pool = search.variations;
    try {
      if (!search.settled) pool = await fetchVariationsByCode(token, raw);
    } catch {
      /* usa o que já foi carregado */
    }
    const exact = exactCodeMatches(pool, raw);
    if (exact.length === 1) {
      if (addVariation(exact[0])) setQuery("");
      focusSearch();
      return;
    }
    if (exact.length > 1) {
      const [group] = groupByProduct(exact);
      if (group) setPicker(group);
      return;
    }
    const groups = groupByProduct(pool);
    if (groups.length === 1) {
      selectGroup(groups[0]);
      setQuery("");
      return;
    }
    if (!groups.length) notify(`Nenhum produto para “${raw}”.`, "error");
  }, [query, search.variations, search.settled, token, addVariation, focusSearch, selectGroup, notify]);

  const submit = useCallback(async () => {
    if (submitting) return;
    if (cart.validationError) {
      notify(cart.validationError, "error");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const editing = cart.editingSale;
    const body = cart.buildPayload();
    try {
      const sale = await apiClient(editing ? `/sales/${editing.id}` : "/sales", {
        method: editing ? "PUT" : "POST",
        token,
        body
      });
      setReceipt({
        sale: { ...sale, id: sale?.id || editing?.id },
        lines: cart.lines,
        totals: cart.totals,
        payment: { ...cart.payment },
        customer: cart.customer,
        change: cart.payment.paymentMethod === "CASH" ? computeChange(cart.totals.total, cart.cashReceived) : null,
        nfceRequested: !editing && body.emitNfce === true,
        edited: Boolean(editing)
      });
      setCartOpen(false);
      cart.reset();
      void refreshAfterSaleMutation();
    } catch (err) {
      setSubmitError(err);
      notify(err.message || "Não foi possível finalizar a venda.", "error");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, cart, token, notify, refreshAfterSaleMutation]);

  // Atalhos: F2 busca · Ctrl/⌘+Enter finaliza · Esc limpa a busca
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "F2") {
        e.preventDefault();
        focusSearch();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (receipt || picker) return;
        e.preventDefault();
        void submit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusSearch, submit, receipt, picker]);

  useEffect(() => {
    focusSearch();
  }, [focusSearch]);

  const cartCountByProduct = useMemo(() => {
    const map = new Map();
    for (const l of cart.lines) {
      const pid = l.variation.product?.id || l.variation.productId;
      if (pid) map.set(pid, (map.get(pid) || 0) + l.quantity);
    }
    return map;
  }, [cart.lines]);

  if (params.get("aba") === "notas") return <Navigate to="/fiscal/notas" replace />;

  const renderCart = (stacked) => (
    <CartPanel
      stacked={stacked}
      cart={cart}
      token={token}
      userType={user?.type}
      enableNfceEmission={enableNfceEmission}
      submitting={submitting}
      onSubmit={submit}
      onNotify={notify}
      onCancelEdit={() => {
        cart.reset();
        navigate("/vendas/historico");
      }}
    />
  );

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Coluna de produtos */}
        <section className="min-w-0 space-y-4" aria-label="Produtos">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="ui-page-title">Vender</h1>
              <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">
                Bipe a etiqueta ou busque por nome, código, tamanho ou cor.
              </p>
            </div>
            <Link to="/vendas/historico" className="ui-btn ui-btn-ghost ui-btn-sm shrink-0">
              <History className="h-4 w-4" aria-hidden />
              Histórico
            </Link>
          </div>

          {cart.editingSale ? (
            <Alert variant="warning" title="Editando uma venda já registrada">
              Ajuste itens, desconto ou pagamento e salve. O estoque é recalculado automaticamente.
            </Alert>
          ) : null}

          <div className="sticky top-14 z-20 -mx-4 bg-canvas/95 px-4 pb-2 pt-1 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8 md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                id="pos-search"
                ref={searchRef}
                type="search"
                className="h-14 rounded-xl pl-11 pr-24 text-base shadow-card sm:min-h-14 sm:text-base"
                placeholder="Bipar ou buscar produto"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleEnter();
                  } else if (e.key === "Escape") {
                    setQuery("");
                  }
                }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Bipar etiqueta ou buscar produto"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      focusSearch();
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : (
                  <span className="hidden lg:inline-flex">
                    <Kbd>F2</Kbd>
                  </span>
                )}
              </div>
            </div>

            <div className="ui-scrollbar-none -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
              <button
                type="button"
                className={cn("ui-chip min-h-9 shrink-0 text-[13px]", !categoryId && "ui-chip-active")}
                onClick={() => setCategoryId("")}
              >
                Todas
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={cn("ui-chip min-h-9 shrink-0 text-[13px]", categoryId === c.id && "ui-chip-active")}
                  onClick={() => setCategoryId((cur) => (cur === c.id ? "" : c.id))}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {search.error ? (
            <Alert variant="danger" title="Não foi possível buscar os produtos">
              {search.error.message}
            </Alert>
          ) : null}

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" aria-hidden />
              {query.trim()
                ? `${search.groups.length} ${search.groups.length === 1 ? "produto" : "produtos"}`
                : categoryId
                  ? "Produtos da categoria"
                  : "Produtos recentes"}
            </span>
            {search.isFetching ? <span>Atualizando…</span> : null}
          </div>

          <ProductResults
            groups={search.groups}
            onSelect={selectGroup}
            cartCountByProduct={cartCountByProduct}
            loading={search.isLoading}
            query={query.trim()}
          />
        </section>

        {/* Carrinho (md+) */}
        <aside
          className="hidden md:block"
          aria-label="Carrinho"
        >
          <div className="ui-surface sticky top-4 flex h-[calc(100dvh-2rem)] max-h-[900px] flex-col overflow-hidden lg:top-8 lg:h-[calc(100dvh-4rem)]">
            {renderCart(false)}
          </div>
          {submitError ? (
            <p className="mt-2 text-xs text-red-700">{getErrorPresentation(submitError).message}</p>
          ) : null}
        </aside>
      </div>

      {/* Barra do carrinho (celular) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="ui-btn ui-btn-primary ui-btn-lg w-full justify-between"
          aria-label="Abrir carrinho"
        >
          <span className="inline-flex items-center gap-2">
            <span className="num flex h-6 min-w-6 items-center justify-center rounded-full bg-white/20 px-1.5 text-xs">
              {cart.totals.itemCount}
            </span>
            {cart.editingSale ? "Editando venda" : "Ver carrinho"}
          </span>
          <span className="num inline-flex items-center gap-1.5 text-base font-semibold">
            {formatCurrencyBRL(cart.totals.total)}
            <ChevronUp className="h-4 w-4" aria-hidden />
          </span>
        </button>
      </div>

      <Sheet open={cartOpen} title="Carrinho" onClose={() => setCartOpen(false)} width="max-w-full sm:max-w-md" bodyClassName="p-0">
        {renderCart(true)}
      </Sheet>

      {picker ? (
        <VariantPicker
          group={picker}
          ceiling={cart.ceiling}
          quantityInCart={cart.quantityInCart}
          onClose={() => {
            setPicker(null);
            setQuery("");
            focusSearch();
          }}
          onPick={(v) => addVariation(v)}
        />
      ) : null}

      {receipt ? (
        <SaleSuccessModal
          receipt={receipt}
          token={token}
          onNotify={notify}
          onNewSale={() => {
            setReceipt(null);
            setQuery("");
            focusSearch();
          }}
        />
      ) : null}
      <SaleReceipt receipt={receipt} tenant={tenant} />
    </div>
  );
}
