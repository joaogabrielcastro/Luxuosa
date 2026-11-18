import { apiBaseUrl, apiClient } from "../../shared/apiClient.js";

/** Baixa o PDF (DANFE) da NFC-e autorizada. */
export async function downloadNfcePdf(token, saleId) {
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
}

/** Força emissão/reemissão (admin, plano Pro). */
export function issueNfce(token, saleId) {
  return apiClient(`/invoices/issue/${saleId}`, { method: "POST", token });
}

/**
 * Situação fiscal resumida de uma venda, a partir de `invoice` e `nfceJob`.
 * @returns {{ key: string, label: string, variant: string }}
 */
export function nfceState(sale) {
  const inv = sale?.invoice;
  const job = sale?.nfceJob;
  if (inv?.status === "ISSUED") return { key: "ISSUED", label: "Autorizada", variant: "success" };
  if (inv?.status === "CANCELED") return { key: "CANCELED", label: "Cancelada", variant: "neutral" };
  if (inv?.status === "ERROR" || job?.status === "FAILED") return { key: "ERROR", label: "Rejeitada / erro", variant: "danger" };
  if (job?.status === "PROCESSING") return { key: "PROCESSING", label: "Enviando à SEFAZ", variant: "info" };
  if (inv?.status === "PENDING" || job?.status === "PENDING") return { key: "PENDING", label: "Na fila", variant: "warning" };
  return { key: "NONE", label: "Sem nota", variant: "neutral" };
}
