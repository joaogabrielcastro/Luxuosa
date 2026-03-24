const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export async function apiClient(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Falha na requisicao" }));
    throw new Error(error.error || "Falha na requisicao");
  }

  if (response.status === 204) return null;
  return response.json();
}
