import { invoiceService } from "../modules/invoices/invoice.service.js";

const chains = new Map();

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetriable(err) {
  const code = err?.statusCode;
  if (code >= 500 && code < 600) return true;
  if (code === 504) return true;
  if (err?.code === "ETIMEDOUT") return true;
  const msg = String(err?.message || "");
  if (/timeout/i.test(msg)) return true;
  return false;
}

async function issueWithRetries(tenantId, saleId) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await invoiceService.issueFromSale(tenantId, saleId, { silent: true });
      return;
    } catch (err) {
      if (!isRetriable(err) || attempt === MAX_ATTEMPTS) {
        console.error(`[NFC-e] venda ${saleId} (tentativa ${attempt}/${MAX_ATTEMPTS}):`, err?.message || err);
        return;
      }
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
}

/**
 * Enfileira emissao de NFC-e por tenant (uma de cada vez por tenantId) para evitar corrida e rate limit.
 */
export function enqueueNfceIssue(tenantId, saleId) {
  const prev = chains.get(tenantId) || Promise.resolve();
  const next = prev
    .then(() => issueWithRetries(tenantId, saleId))
    .catch((err) => {
      console.error(`[NFC-e] fila tenant ${tenantId}:`, err?.message || err);
    });
  chains.set(tenantId, next);
}
