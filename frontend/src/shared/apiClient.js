/** Base da API (inclui `/api/v1`). Usar em `fetch` fora do apiClient (ex.: PDF blob). */
export const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

function defaultMessageForStatus(status) {
  if (status === 401) return "Sessao expirada ou nao autorizado. Faca login novamente.";
  if (status === 403) return "Voce nao tem permissao para esta acao.";
  if (status === 404) return "Recurso nao encontrado.";
  if (status === 409) return "Conflito: registro duplicado ou estado invalido.";
  if (status === 422) return "Nao foi possivel processar os dados enviados.";
  if (status >= 500) return "Erro no servidor. Tente novamente em instantes.";
  return "Nao foi possivel completar a operacao.";
}

/** Evita mostrar ao utilizador mensagens tecnicas (Prisma, SQL, stack). */
function humanizeErrorText(raw, status) {
  const s = String(raw || "").trim();
  if (!s) return defaultMessageForStatus(status);
  if (
    /Invalid `prisma\./i.test(s) ||
    /PrismaClient/i.test(s) ||
    /ConnectorError|P20\d{3}/i.test(s) ||
    /foreign key|RESTRICT|violates/i.test(s) ||
    /StockMovement_|productVariationId/i.test(s)
  ) {
    if (status === 409) {
      return "Nao e possivel excluir: ainda ha dados ligados a este item (estoque, vendas ou outro cadastro).";
    }
    if (status >= 500) return "Erro no servidor ao guardar dados. Tente de novo ou contacte o suporte.";
    return "Nao foi possivel concluir a operacao. Verifique os dados e tente novamente.";
  }
  return s;
}

function extractErrorMessage(data, status) {
  if (data == null) return defaultMessageForStatus(status);
  let raw = null;
  if (typeof data.error === "string" && data.error.trim()) raw = data.error;
  else if (typeof data.message === "string" && data.message.trim()) raw = data.message;
  else if (Array.isArray(data) && data[0]?.message) {
    raw = data.map((x) => x.message).filter(Boolean).join(" ");
  }
  if (raw == null) return defaultMessageForStatus(status);
  return humanizeErrorText(raw, status);
}

export async function apiClient(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = extractErrorMessage(data, response.status);
    const err = new Error(message);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  if (response.status === 204) return null;
  return response.json();
}
