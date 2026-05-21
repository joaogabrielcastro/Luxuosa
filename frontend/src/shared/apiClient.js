/** Base da API (inclui `/api/v1`). Usar em `fetch` fora do apiClient (ex.: PDF blob). */
export const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

import { parseApiErrorPayload } from "./apiErrors.js";

/** Disparado em 401 para limpar sessao (useAuth escuta). */
export const AUTH_UNAUTHORIZED_EVENT = "luxuosa:unauthorized";

function notifyUnauthorized() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  }
}

/**
 * Erro de API com mensagem em portugues e detalhes opcionais por campo.
 */
export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details || [];
  }
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
    if (response.status === 401) notifyUnauthorized();
    const { message, code, details, status } = parseApiErrorPayload(data, response.status);
    throw new ApiError(message, { status, code, details });
  }

  if (response.status === 204) return null;
  return response.json();
}
