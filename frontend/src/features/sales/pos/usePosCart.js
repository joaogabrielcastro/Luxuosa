import { useCallback, useMemo, useState } from "react";
import { amountToCurrencyInput, formatCurrencyInputValue, parseCurrencyInput } from "../../../shared/formatters.js";
import { buildSalePayload, computeTotals, discountIssue, variationAttributes, variationName } from "./posUtils.js";

const INITIAL_PAYMENT = { paymentMethod: "PIX", installments: 2 };

/**
 * Estado do carrinho do PDV.
 * Cada linha guarda uma cópia da variação (nome, grade, estoque, preço) — o PDV não depende
 * de ter o catálogo inteiro em memória.
 */
export function usePosCart({ userType, enableNfceEmission }) {
  const [lines, setLines] = useState([]);
  const [discountMode, setDiscountMode] = useState("value");
  const [discountInput, setDiscountInput] = useState("");
  const [customer, setCustomer] = useState(null);
  const [payment, setPayment] = useState(INITIAL_PAYMENT);
  const [emitNfce, setEmitNfce] = useState(true);
  const [cashReceived, setCashReceived] = useState("");
  const [editingSale, setEditingSale] = useState(null);
  /** Ao editar: unidades da venda original por variação (o estoque delas "volta" na validação). */
  const [stockRelease, setStockRelease] = useState(() => new Map());

  const ceiling = useCallback(
    (variation) => Number(variation?.stock ?? 0) + (stockRelease.get(variation?.id) || 0),
    [stockRelease]
  );

  const quantityInCart = useCallback(
    (variationId) => lines.find((l) => l.variation.id === variationId)?.quantity || 0,
    [lines]
  );

  /** @returns {{ ok: boolean, message?: string }} */
  const addVariation = useCallback(
    (variation, qty = 1) => {
      const max = ceiling(variation);
      const current = lines.find((l) => l.variation.id === variation.id);
      const next = (current?.quantity || 0) + qty;
      if (max < 1) return { ok: false, message: `${variationName(variation)} está sem estoque.` };
      if (next > max) return { ok: false, message: `Estoque disponível: ${max} un.` };
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.variation.id === variation.id);
        if (idx >= 0) {
          return prev.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + qty } : l));
        }
        return [
          ...prev,
          {
            variation,
            quantity: qty,
            unitPrice: amountToCurrencyInput(Number(variation.product?.price || 0))
          }
        ];
      });
      const attrs = variationAttributes(variation);
      return { ok: true, message: `${variationName(variation)}${attrs ? ` (${attrs})` : ""} adicionado.` };
    },
    [ceiling, lines]
  );

  const setQuantity = useCallback(
    (variationId, rawQty) => {
      const line = lines.find((l) => l.variation.id === variationId);
      if (!line) return { ok: false };
      const qty = Math.floor(Number(rawQty));
      if (!Number.isFinite(qty)) return { ok: false };
      if (qty < 1) {
        setLines((prev) => prev.filter((l) => l.variation.id !== variationId));
        return { ok: true };
      }
      const max = ceiling(line.variation);
      const clamped = Math.min(qty, max);
      setLines((prev) => prev.map((l) => (l.variation.id === variationId ? { ...l, quantity: clamped } : l)));
      return clamped < qty ? { ok: false, message: `Estoque máximo para este item: ${max} un.` } : { ok: true };
    },
    [ceiling, lines]
  );

  const setUnitPrice = useCallback((variationId, unitPrice) => {
    setLines((prev) => prev.map((l) => (l.variation.id === variationId ? { ...l, unitPrice } : l)));
  }, []);

  const removeLine = useCallback((variationId) => {
    setLines((prev) => prev.filter((l) => l.variation.id !== variationId));
  }, []);

  const reset = useCallback(() => {
    setLines([]);
    setDiscountInput("");
    setDiscountMode("value");
    setCustomer(null);
    setPayment(INITIAL_PAYMENT);
    setCashReceived("");
    setEditingSale(null);
    setStockRelease(new Map());
  }, []);

  /** Carrega uma venda existente (GET /sales/:id) para edição. */
  const loadSale = useCallback((sale) => {
    const release = new Map();
    for (const it of sale.items || []) {
      release.set(it.productVariationId, (release.get(it.productVariationId) || 0) + Number(it.quantity || 0));
    }
    setStockRelease(release);
    setLines(
      (sale.items || []).map((it) => ({
        variation: { ...(it.productVariation || {}), id: it.productVariationId },
        quantity: Number(it.quantity),
        unitPrice: formatCurrencyInputValue(it.unitPrice)
      }))
    );
    const dv = Number(sale.discountValue || 0);
    const dp = Number(sale.discountPercent || 0);
    if (dp > 0 && dv <= 0) {
      setDiscountMode("percent");
      setDiscountInput(String(dp).replace(".", ","));
    } else if (dv > 0 && dp <= 0) {
      setDiscountMode("value");
      setDiscountInput(formatCurrencyInputValue(dv));
    } else if (dv > 0 && dp > 0) {
      // Venda antiga com os dois descontos: consolida em valor (o total da venda não muda).
      const gross = (sale.items || []).reduce((a, it) => a + Number(it.quantity) * Number(it.unitPrice), 0);
      setDiscountMode("value");
      setDiscountInput(formatCurrencyInputValue(dv + (gross * dp) / 100));
    } else {
      setDiscountMode("value");
      setDiscountInput("");
    }
    setCustomer(sale.customer ? { id: sale.customer.id, name: sale.customer.name, cpfCnpj: sale.customer.cpfCnpj } : null);
    setPayment({
      paymentMethod: sale.paymentMethod,
      installments: Math.max(2, Number(sale.installments || 2))
    });
    setCashReceived("");
    setEditingSale({ id: sale.id, occurredAt: sale.occurredAt });
  }, []);

  const totals = useMemo(() => computeTotals(lines, { discountMode, discountInput }), [lines, discountMode, discountInput]);
  const discountError = useMemo(() => discountIssue(totals, userType), [totals, userType]);

  const validationError = useMemo(() => {
    if (!lines.length) return "Adicione pelo menos um produto.";
    for (const l of lines) {
      if (!(Number(l.quantity) >= 1)) return `Quantidade inválida em ${variationName(l.variation)}.`;
      if (!(parseCurrencyInput(l.unitPrice) > 0)) {
        return `Informe o preço de ${variationName(l.variation)}.`;
      }
      if (Number(l.quantity) > ceiling(l.variation)) return `Estoque insuficiente para ${variationName(l.variation)}.`;
    }
    return discountError;
  }, [lines, discountError, ceiling]);

  const buildPayload = useCallback(
    () =>
      buildSalePayload({
        lines,
        totals,
        paymentMethod: payment.paymentMethod,
        installments: payment.installments,
        customerId: customer?.id,
        emitNfce: enableNfceEmission ? emitNfce : false,
        editing: Boolean(editingSale)
      }),
    [lines, totals, payment, customer, emitNfce, enableNfceEmission, editingSale]
  );

  return {
    lines,
    totals,
    discountMode,
    setDiscountMode: (mode) => {
      setDiscountMode(mode);
      setDiscountInput("");
    },
    discountInput,
    setDiscountInput,
    discountError,
    customer,
    setCustomer,
    payment,
    setPayment,
    emitNfce,
    setEmitNfce,
    cashReceived,
    setCashReceived,
    editingSale,
    validationError,
    ceiling,
    quantityInCart,
    addVariation,
    setQuantity,
    setUnitPrice,
    removeLine,
    reset,
    loadSale,
    buildPayload
  };
}
