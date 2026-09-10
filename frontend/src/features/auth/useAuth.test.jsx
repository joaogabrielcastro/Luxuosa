import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./useAuth.jsx";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn()
}));

vi.mock("../../shared/apiClient.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, apiClient };
});

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span>{auth.token || "sem-token"}</span>
      <button type="button" onClick={() => auth.login("a@loja.com", "senha123")}>
        login
      </button>
      <button type="button" onClick={() => auth.logout()}>
        sair
      </button>
      <button type="button" onClick={() => auth.refreshSession()}>
        refresh
      </button>
    </div>
  );
}

describe("useAuth", () => {
  beforeEach(() => {
    apiClient.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("login grava sessao e logout limpa", async () => {
    const user = userEvent.setup();
    apiClient.mockImplementation(async (path, opts) => {
      if (path === "/auth/login" || path === "/auth/me") {
        return {
          token: "tok",
          user: { id: "u1", type: "ADMIN" },
          tenant: { id: "t1" }
        };
      }
      return {};
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByText("sem-token")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "login" }));
    expect(await screen.findByText("tok")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "sair" }));
    expect(await screen.findByText("sem-token")).toBeInTheDocument();
  });

  it("refreshSession atualiza tenant", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "luxuosa_session",
      JSON.stringify({ token: "tok", user: { id: "u1" }, tenant: { id: "t1", name: "A" } })
    );
    apiClient.mockResolvedValue({ user: { id: "u1" }, tenant: { id: "t1", name: "B" } });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await user.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith("/auth/me", expect.objectContaining({ token: "tok" }));
    });
  });
});
