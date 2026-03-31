export const PAYMENT_LABELS = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartao credito",
  DEBIT_CARD: "Cartao debito",
  INSTALLMENT: "Parcelado"
};

export const SALE_STATUS_LABELS = {
  OPEN: "Aberta",
  PAID: "Paga",
  CANCELED: "Cancelada"
};

export const JOB_STATUS_LABELS = {
  PENDING: "Na fila",
  PROCESSING: "Processando",
  COMPLETED: "Concluido",
  FAILED: "Falhou"
};

export const DEFAULT_SALE_FORM = {
  paymentMethod: "PIX",
  installments: 1,
  discountValue: "",
  discountPercent: ""
};
