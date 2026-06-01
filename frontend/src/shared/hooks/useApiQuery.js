import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../apiClient.js";

/**
 * GET autenticado com cache TanStack Query.
 * @param {string[]} queryKey
 * @param {string} path
 * @param {{ token?: string, enabled?: boolean } & import('@tanstack/react-query').UseQueryOptions} options
 */
export function useApiQuery(queryKey, path, { token, enabled = true, ...options } = {}) {
  return useQuery({
    queryKey: [...queryKey, token],
    enabled: Boolean(token) && enabled,
    queryFn: () => apiClient(path, { token }),
    ...options
  });
}
