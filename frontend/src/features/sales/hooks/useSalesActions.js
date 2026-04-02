import { useState } from "react";
import { apiBaseUrl, apiClient } from "../../../shared/apiClient.js";
import { maskCurrencyInput, parseCurrencyInput } from "../../../shared/formatters.js";
import { DEFAULT_SALE_FORM } from "../sales.constants.js";

export function useSalesActions({ token, variations, load, setError, showToast, confirm }) {
  const [form, setForm] = useState(DEFAULT_SALE_FORM);
  const [items, setItems] = useState([]);
  const [editingSaleId, setEditingSaleId] = useState(null);
  /** Ao editar venda: quantidades da venda original por variacao (estoque "devolvido" na validacao). */
  const [editSaleStockRelease, setEditSaleStockRelease] = useState(() => new Map());
  const [loading, setLoading] = useState(false);

  function parseQuantity(raw) {
    if (raw === "" || raw === undefined) return 1;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }

  function ceilingForVariation(variationId) {
    const v = variations.find((x) => x.id === variationId);
    const base = Number(v?.stock ?? 0);
    const released = editSaleStockRelease.get(variationId) || 0;
    return base + released;
  }

  function sumQtyForVariation(cart, variationId, excludeIndex = -1) {
    return cart.reduce((acc, it, idx) => {
      if (idx === excludeIndex) return acc;
      if (it.productVariationId !== variationId) return acc;
      const q = parseQuantity(it.quantity);
      return acc + (Number.isInteger(q) && q >= 1 ? q : 0);
    }, 0);
  }

  /** Quantidade ainda disponivel para incluir no carrinho (considera edicao de venda). */
  function remainingUnits(variationId, cart, excludeIndex = -1) {
    return Math.max(0, ceilingForVariation(variationId) - sumQtyForVariation(cart, variationId, excludeIndex));
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index, key, value) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        let next = { ...item, [key]: value };
        if (key === "categoryId") {
          next.brandId = "";
          next.productVariationId = "";
          next.unitPrice = "";
        }
        if (key === "brandId") {
          next.productVariationId = "";
          next.unitPrice = "";
        }
        if (key === "productVariationId") {
          const selectedVariation = variations.find((variation) => variation.id === value);
          const productPrice = Number(selectedVariation?.product?.price || 0);
          next.unitPrice = productPrice > 0 ? maskCurrencyInput(String(Math.round(productPrice * 100))) : "";
        }
        if (key === "unitPrice") {
          next.unitPrice = maskCurrencyInput(value);
        }
        if (key === "quantity") {
          const vid = item.productVariationId;
          const maxQ = ceilingForVariation(vid);
          let q = parseQuantity(value);
          if (Number.isInteger(q) && q >= 1 && q > maxQ) {
            showToast(`Estoque maximo para esta variacao: ${maxQ}.`, "error");
            q = maxQ;
          }
          if (Number.isInteger(q) && q >= 1) {
            next = { ...next, quantity: String(q) };
          }
        }
        return next;
      })
    );
  }

  /** Bip ou SKU exato — incrementa +1 se o item ja estiver na lista. */
  function addItemByBarcode(code) {
    const raw = String(code ?? "").trim();
    if (!raw) return;

    const candidates = variations.filter((v) => String(v.product?.sku || "").trim() === raw);
    if (!candidates.length) {
      showToast("Codigo / SKU nao encontrado.", "error");
      return;
    }

    const selected = candidates.find((v) => remainingUnits(v.id, items) > 0) || null;
    if (!selected) {
      showToast("Sem estoque disponivel para este codigo.", "error");
      return;
    }

    const existingIdx = items.findIndex((it) => it.productVariationId === selected.id);
    const productPrice = Number(selected.product?.price || 0);
    const maskedUnitPrice = productPrice > 0 ? maskCurrencyInput(String(Math.round(productPrice * 100))) : "";

    if (existingIdx >= 0) {
      const canAdd = remainingUnits(selected.id, items, existingIdx);
      if (canAdd < 1) {
        showToast("Sem estoque disponivel para aumentar a quantidade.", "error");
        return;
      }
      setItems((prev) =>
        prev.map((it, idx) => {
          if (idx !== existingIdx) return it;
          const current = Number(it.quantity || 0);
          return { ...it, quantity: String(Math.max(1, current) + 1) };
        })
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          categoryId: selected.product?.categoryId || "",
          brandId: selected.product?.brandId || "",
          productVariationId: selected.id,
          quantity: "1",
          unitPrice: maskedUnitPrice
        }
      ]);
    }

    showToast(`Item adicionado: ${selected.product?.name || "Produto"}.`);
  }

  /** Fluxo manual: categoria + marca + produto + quantidade. */
  function addManualLine(draft) {
    const { categoryId, brandId, productVariationId, quantity } = draft;
    if (!categoryId || !brandId || !productVariationId) {
      showToast("Selecione categoria, marca e produto.", "error");
      return;
    }
    const qty = parseQuantity(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      showToast("Informe uma quantidade valida (inteiro >= 1).", "error");
      return;
    }

    const selected = variations.find((v) => v.id === productVariationId);
    if (!selected) {
      showToast("Variacao invalida.", "error");
      return;
    }

    const productPrice = Number(selected.product?.price || 0);
    const maskedUnitPrice = productPrice > 0 ? maskCurrencyInput(String(Math.round(productPrice * 100))) : "";
    const existingIdx = items.findIndex((it) => it.productVariationId === selected.id);
    const rem = remainingUnits(selected.id, items, existingIdx >= 0 ? existingIdx : -1);
    if (existingIdx >= 0) {
      if (qty > rem) {
        showToast(`Sem estoque suficiente. Disponivel: ${rem}.`, "error");
        return;
      }
      setItems((prev) =>
        prev.map((it, idx) => {
          if (idx !== existingIdx) return it;
          const current = parseQuantity(it.quantity);
          return { ...it, quantity: String(Math.max(1, current + qty)) };
        })
      );
    } else {
      if (qty > rem) {
        showToast(`Sem estoque suficiente. Disponivel: ${rem}.`, "error");
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          categoryId: selected.product?.categoryId || "",
          brandId: selected.product?.brandId || "",
          productVariationId: selected.id,
          quantity: String(qty),
          unitPrice: maskedUnitPrice
        }
      ]);
    }
    showToast(`${selected.product?.name || "Item"} adicionado à lista.`);
  }

  function addItemByVariationId(variationId) {
    const selected = variations.find((v) => v.id === variationId);
    if (!selected) return;
    const existingIdx = items.findIndex((it) => it.productVariationId === selected.id);
    const productPrice = Number(selected.product?.price || 0);
    const maskedUnitPrice = productPrice > 0 ? maskCurrencyInput(String(Math.round(productPrice * 100))) : "";

    if (existingIdx >= 0) {
      const canAdd = remainingUnits(selected.id, items, existingIdx);
      if (canAdd < 1) {
        showToast("Sem estoque disponivel para aumentar a quantidade.", "error");
        return;
      }
      setItems((prev) =>
        prev.map((it, idx) => {
          if (idx !== existingIdx) return it;
          const current = Number(it.quantity || 0);
          return { ...it, quantity: String(Math.max(1, current) + 1) };
        })
      );
    } else {
      if (remainingUnits(selected.id, items) < 1) {
        showToast("Sem estoque disponivel para esta variacao.", "error");
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          categoryId: selected.product?.categoryId || "",
          brandId: selected.product?.brandId || "",
          productVariationId: selected.id,
          quantity: "1",
          unitPrice: maskedUnitPrice
        }
      ]);
    }
    showToast(`Item adicionado: ${selected.product?.name || "Produto"}.`);
  }

  async function retryNfce(saleId) {
    setLoading(true);
    try {
      const inv = await apiClient(`/invoices/issue/${saleId}`, { method: "POST", token });
      showToast(
        inv?.key
          ? `NFC-e autorizada. Chave: ${String(inv.key).slice(0, 20)}...`
          : "NFC-e processada. Atualize a lista."
      );
      await load();
    } catch (err) {
      showToast(err.message || "Falha ao emitir NFC-e", "error");
    } finally {
      setLoading(false);
    }
  }

  async function downloadNfcePdf(saleId) {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/invoices/sale/${saleId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Falha ao baixar PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nfce-${saleId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err.message || "Falha ao baixar PDF", "error");
    } finally {
      setLoading(false);
    }
  }

  async function createSale(event) {
    event.preventDefault();
    setError("");
    if (!items.length) {
      const msg = "Adicione pelo menos um produto à venda.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    for (let i = 0; i < items.length; i += 1) {
      const row = items[i];
      if (!row.categoryId) {
        const msg = `Item ${i + 1}: selecione a categoria.`;
        setError(msg);
        showToast(msg, "error");
        return;
      }
      if (!row.brandId) {
        const msg = `Item ${i + 1}: selecione a marca.`;
        setError(msg);
        showToast(msg, "error");
        return;
      }
      if (!row.productVariationId) {
        const msg = `Item ${i + 1}: selecione o produto e a variacao.`;
        setError(msg);
        showToast(msg, "error");
        return;
      }
      const unit = parseCurrencyInput(row.unitPrice);
      if (unit <= 0) {
        const msg = `Item ${i + 1}: informe um preco unitario maior que zero.`;
        setError(msg);
        showToast(msg, "error");
        return;
      }
      const qty = parseQuantity(row.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        const msg = `Item ${i + 1}: informe uma quantidade inteira (minimo 1).`;
        setError(msg);
        showToast(msg, "error");
        return;
      }
      const maxQ = ceilingForVariation(row.productVariationId);
      if (qty > maxQ) {
        const msg = `Item ${i + 1}: estoque insuficiente (maximo ${maxQ}).`;
        setError(msg);
        showToast(msg, "error");
        return;
      }
    }
    setLoading(true);
    try {
      const endpoint = editingSaleId ? `/sales/${editingSaleId}` : "/sales";
      const method = editingSaleId ? "PUT" : "POST";
      const installments =
        form.paymentMethod === "INSTALLMENT" ? Math.max(2, Number(form.installments) || 2) : 1;
      const body = {
        paymentMethod: form.paymentMethod,
        installments,
        discountValue: form.discountValue === "" ? 0 : Number(form.discountValue),
        discountPercent: form.discountPercent === "" ? 0 : Number(form.discountPercent),
        items: items.map((item) => ({
          productVariationId: item.productVariationId,
          quantity: parseQuantity(item.quantity),
          unitPrice: parseCurrencyInput(item.unitPrice)
        }))
      };
      /** `Boolean(undefined)` vira false e quebrava o padrao; `!== false` reflete desmarcado e omissao corretamente. */
      if (!editingSaleId) {
        body.emitNfce = form.emitNfce !== false;
      }

      await apiClient(endpoint, {
        method,
        token,
        body
      });
      showToast(editingSaleId ? "Venda atualizada." : "Venda criada.");
      setEditingSaleId(null);
      setEditSaleStockRelease(new Map());
      setForm((prev) => ({
        ...DEFAULT_SALE_FORM,
        emitNfce: prev.emitNfce
      }));
      setItems([]);
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function editSale(sale) {
    const startEditWithData = (fullSale) => {
      setEditingSaleId(fullSale.id);
      const dv = Number(fullSale.discountValue || 0);
      const dp = Number(fullSale.discountPercent || 0);
      setForm({
        paymentMethod: fullSale.paymentMethod,
        installments: Math.max(1, Number(fullSale.installments || 1)),
        discountValue: dv !== 0 ? dv : "",
        discountPercent: dp !== 0 ? dp : "",
        emitNfce: DEFAULT_SALE_FORM.emitNfce
      });
      const release = new Map();
      for (const it of fullSale.items || []) {
        const id = it.productVariationId;
        release.set(id, (release.get(id) || 0) + Number(it.quantity || 0));
      }
      setEditSaleStockRelease(release);
      setItems(
        (fullSale.items || []).map((item) => {
          const fromApi = item.productVariation;
          const fromList = variations.find((v) => v.id === item.productVariationId);
          const categoryId = fromApi?.product?.categoryId || fromList?.product?.categoryId || "";
          const brandId = fromApi?.product?.brandId || fromList?.product?.brandId || "";
          return {
            categoryId,
            brandId,
            productVariationId: item.productVariationId,
            quantity: String(item.quantity),
            unitPrice: maskCurrencyInput(String(Math.round(Number(item.unitPrice) * 100)))
          };
        })
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (sale.items?.length) {
      startEditWithData(sale);
      return;
    }

    setLoading(true);
    apiClient(`/sales/${sale.id}`, { token })
      .then((fullSale) => {
        startEditWithData(fullSale);
      })
      .catch((err) => {
        showToast(err.message || "Falha ao carregar venda para edicao", "error");
      })
      .finally(() => setLoading(false));
  }

  async function cancelSale(saleId) {
    setError("");
    try {
      const confirmed = await confirm({
        title: "Cancelar venda",
        message: "Deseja cancelar esta venda? O estoque sera estornado.",
        confirmText: "Cancelar venda"
      });
      if (!confirmed) return;
      await apiClient(`/sales/${saleId}/cancel`, { method: "POST", token });
      await load();
      showToast("Venda cancelada.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  function cancelEdit() {
    setEditingSaleId(null);
    setEditSaleStockRelease(new Map());
    setForm(DEFAULT_SALE_FORM);
    setItems([]);
  }

  return {
    form,
    setForm,
    items,
    editingSaleId,
    loading,
    updateItem,
    removeItem,
    addItemByBarcode,
    addItemByVariationId,
    addManualLine,
    createSale,
    editSale,
    cancelSale,
    cancelEdit,
    retryNfce,
    downloadNfcePdf,
    getRemainingUnits: (variationId, excludeIndex = -1) => remainingUnits(variationId, items, excludeIndex)
  };
}
