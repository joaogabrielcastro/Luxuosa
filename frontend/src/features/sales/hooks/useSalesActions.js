import { useState } from "react";
import { apiBaseUrl, apiClient } from "../../../shared/apiClient.js";
import { maskCurrencyInput, parseCurrencyInput } from "../../../shared/formatters.js";
import { DEFAULT_SALE_FORM } from "../sales.constants.js";
import { emptyLineItem } from "../sales.utils.js";

export function useSalesActions({ token, variations, load, setError, showToast, confirm }) {
  const [form, setForm] = useState(DEFAULT_SALE_FORM);
  const [items, setItems] = useState([emptyLineItem()]);
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");

  function parseQuantity(raw) {
    if (raw === "" || raw === undefined) return 1;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }

  function addItem() {
    setItems((prev) => [...prev, emptyLineItem()]);
  }

  function updateItem(index, key, value) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [key]: value };
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
        return next;
      })
    );
  }

  function addItemByBarcode() {
    const code = String(barcodeInput || "").trim();
    if (!code) return;

    const candidates = variations.filter((v) => String(v.product?.sku || "").trim() === code);
    if (!candidates.length) {
      showToast("Codigo nao encontrado nos produtos.", "error");
      return;
    }

    const selected = candidates.find((v) => Number(v.stock) > 0) || candidates[0];
    const existingIdx = items.findIndex((it) => it.productVariationId === selected.id);
    const productPrice = Number(selected.product?.price || 0);
    const maskedUnitPrice = productPrice > 0 ? maskCurrencyInput(String(Math.round(productPrice * 100))) : "";

    if (existingIdx >= 0) {
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

    setBarcodeInput("");
    showToast(`Item adicionado: ${selected.product?.name || "Produto"}.`);
  }

  function addItemByVariationId(variationId) {
    const selected = variations.find((v) => v.id === variationId);
    if (!selected) return;
    const existingIdx = items.findIndex((it) => it.productVariationId === selected.id);
    const productPrice = Number(selected.product?.price || 0);
    const maskedUnitPrice = productPrice > 0 ? maskCurrencyInput(String(Math.round(productPrice * 100))) : "";

    if (existingIdx >= 0) {
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
    }
    setLoading(true);
    try {
      const endpoint = editingSaleId ? `/sales/${editingSaleId}` : "/sales";
      const method = editingSaleId ? "PUT" : "POST";
      await apiClient(endpoint, {
        method,
        token,
        body: {
          ...form,
          installments: form.paymentMethod === "INSTALLMENT" ? Math.max(2, Number(form.installments) || 2) : 1,
          discountValue: form.discountValue === "" ? 0 : Number(form.discountValue),
          discountPercent: form.discountPercent === "" ? 0 : Number(form.discountPercent),
          items: items.map((item) => ({
            productVariationId: item.productVariationId,
            quantity: parseQuantity(item.quantity),
            unitPrice: parseCurrencyInput(item.unitPrice)
          }))
        }
      });
      showToast(editingSaleId ? "Venda atualizada." : "Venda criada.");
      setEditingSaleId(null);
      setForm(DEFAULT_SALE_FORM);
      setItems([emptyLineItem()]);
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
        discountPercent: dp !== 0 ? dp : ""
      });
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
    setForm(DEFAULT_SALE_FORM);
    setItems([emptyLineItem()]);
  }

  return {
    form,
    setForm,
    items,
    editingSaleId,
    loading,
    barcodeInput,
    setBarcodeInput,
    addItem,
    updateItem,
    addItemByBarcode,
    addItemByVariationId,
    createSale,
    editSale,
    cancelSale,
    cancelEdit,
    retryNfce,
    downloadNfcePdf
  };
}
