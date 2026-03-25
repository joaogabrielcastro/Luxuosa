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

function extractErrorMessage(data, status) {
  if (data == null) return defaultMessageForStatus(status);
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (Array.isArray(data) && data[0]?.message) {
    return data.map((x) => x.message).filter(Boolean).join(" ");
  }
  return defaultMessageForStatus(status);
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
