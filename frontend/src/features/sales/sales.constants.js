export const PAYMENT_LABELS = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão crédito",
  DEBIT_CARD: "Cartão débito",
  INSTALLMENT: "Cartão parcelado"
};

export const SALE_STATUS_LABELS = {
  OPEN: "Aberta",
  PAID: "Paga",
  CANCELED: "Cancelada"
};

export const JOB_STATUS_LABELS = {
  PENDING: "Na fila",
  PROCESSING: "Processando",
  COMPLETED: "Concluído",
  FAILED: "Falhou"
};

export const DEFAULT_SALE_FORM = {
  paymentMethod: "PIX",
  installments: 1,
  discountValue: "",
  discountPercent: "",
  customerId: "",
  /** Apenas na criacao: enfileira emissao NFC-e apos a venda. */
  emitNfce: true
};
