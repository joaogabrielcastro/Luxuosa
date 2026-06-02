import { PaymentMethod } from "@prisma/client";

const PAYMENT_ALIASES = {
  dinheiro: PaymentMethod.CASH,
  cartao_credito: PaymentMethod.CREDIT_CARD,
  cartao_debito: PaymentMethod.DEBIT_CARD,
  pix: PaymentMethod.PIX,
  parcelamento: PaymentMethod.INSTALLMENT,
  cash: PaymentMethod.CASH,
  credit_card: PaymentMethod.CREDIT_CARD,
  debit_card: PaymentMethod.DEBIT_CARD,
  installment: PaymentMethod.INSTALLMENT
};

const VALID_PAYMENT = new Set(Object.values(PaymentMethod));

export function normalizePaymentMethod(method) {
  const raw = String(method ?? "").trim();
  const mapped = PAYMENT_ALIASES[raw.toLowerCase()] ?? raw;
  if (!VALID_PAYMENT.has(mapped)) {
    const err = new Error(
      "Forma de pagamento invalida. Use: dinheiro, pix, cartao_credito, cartao_debito ou parcelamento."
    );
    err.statusCode = 400;
    throw err;
  }
  return mapped;
}

export function assertNoDuplicateVariationLines(items) {
  const seen = new Set();
  for (const item of items) {
    const id = item.productVariationId;
    if (seen.has(id)) {
      const err = new Error("Nao e permitido repetir a mesma variacao na venda. Ajuste a quantidade na linha existente.");
      err.statusCode = 400;
      throw err;
    }
    seen.add(id);
  }
}

export async function assertCustomerBelongsToTenant(tx, tenantId, customerId) {
  if (!customerId) return;
  const customer = await tx.customer.findFirst({
    where: { tenantId, id: customerId },
    select: { id: true }
  });
  if (!customer) {
    const err = new Error("Cliente nao encontrado nesta loja.");
    err.statusCode = 400;
    throw err;
  }
}
