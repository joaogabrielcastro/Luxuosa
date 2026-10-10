import { prisma } from "../config/prisma.js";

export const AUDIT_ACTIONS = {
  STOCK_ENTRY: "STOCK_ENTRY",
  STOCK_EXIT: "STOCK_EXIT",
  NFE_IMPORT_COMPLETED: "NFE_IMPORT_COMPLETED",
  PRODUCT_CREATED: "PRODUCT_CREATED",
  PRODUCT_PRICE_CHANGED: "PRODUCT_PRICE_CHANGED",
  PRODUCT_COST_CHANGED: "PRODUCT_COST_CHANGED",
  SALE_CREATED: "SALE_CREATED",
  SALE_CANCELED: "SALE_CANCELED",
  CREDIT_SALE_CREATED: "CREDIT_SALE_CREATED",
  CREDIT_SALE_CANCELED: "CREDIT_SALE_CANCELED",
  CREDIT_SALE_DELETED: "CREDIT_SALE_DELETED",
  CREDIT_PAYMENT_RECEIVED: "CREDIT_PAYMENT_RECEIVED",
  CREDIT_EVENT_CONFIGURED: "CREDIT_EVENT_CONFIGURED",
  CREDIT_EVENT_CLOSED: "CREDIT_EVENT_CLOSED",
  CUSTOMER_CREATED: "CUSTOMER_CREATED",
  CASH_OPENED: "CASH_OPENED",
  CASH_CLOSED: "CASH_CLOSED",
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED"
};

/**
 * Grava um evento de auditoria. Nao propaga erro para nao quebrar a operacao principal
 * quando chamado fora de transacao (safeRecord). Dentro de tx, use recordAuditInTx.
 */
export async function recordAudit(
  {
    tenantId,
    userId = null,
    action,
    entityType = null,
    entityId = null,
    summary,
    meta = null
  },
  client = prisma
) {
  return client.auditLog.create({
    data: {
      tenantId,
      userId: userId || null,
      action,
      entityType,
      entityId,
      summary: String(summary || "").slice(0, 500),
      meta: meta ?? undefined
    }
  });
}

export async function recordAuditInTx(tx, entry) {
  return recordAudit(entry, tx);
}

/** Melhor esforco apos operacao ja commitada. */
export function safeRecordAudit(entry) {
  return recordAudit(entry).catch((err) => {
    console.error("[audit]", err?.message || err);
  });
}
