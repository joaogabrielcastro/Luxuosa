import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell.jsx";

const logout = vi.fn();

vi.mock("../../features/auth/useAuth.jsx", () => ({
  useAuth: () => ({
    logout,
    user: { id: "u1", name: "Admin", type: "ADMIN" },
    tenant: { id: "t1", name: "Loja Teste", cnpj: "12345678000199" }
  })
}));

vi.mock("../apiClient.js", () => ({
  apiClient: vi.fn()
}));

describe("AppShell", () => {
  it("mostra loja, navegacao e sai", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppShell>
          <p>conteudo</p>
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.getByText("Loja Teste")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /navegação principal/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    await user.click(screen.getAllByRole("button", { name: "Fechar menu" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Sair" })[0]);
    expect(logout).toHaveBeenCalled();
  });
});
