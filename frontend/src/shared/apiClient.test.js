import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, AUTH_UNAUTHORIZED_EVENT, apiClient } from "./apiClient.js";

describe("apiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET devolve JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true })
      }))
    );
    await expect(apiClient("/health")).resolves.toEqual({ ok: true });
  });

  it("204 devolve null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 204, json: async () => ({}) })));
    await expect(apiClient("/x", { method: "DELETE", token: "t" })).resolves.toBeNull();
  });

  it("401 dispara evento e ApiError", async () => {
    const seen = [];
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, () => seen.push(1));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: "Sessao invalida.", code: "TOKEN_INVALID" })
      }))
    );
    await expect(apiClient("/me", { token: "x" })).rejects.toBeInstanceOf(ApiError);
    expect(seen.length).toBe(1);
  });

  it("erro sem JSON usa status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("no json");
        }
      }))
    );
    await expect(apiClient("/boom")).rejects.toMatchObject({ status: 500 });
  });
});
