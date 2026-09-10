import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage.jsx";

const login = vi.fn();

vi.mock("./useAuth.jsx", () => ({
  useAuth: () => ({ login, token: null, user: null })
}));

describe("LoginPage", () => {
  it("mostra o formulario e envia login", async () => {
    const user = userEvent.setup();
    login.mockResolvedValueOnce({});
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("voce@loja.com"), "a@loja.com");
    await user.type(screen.getByPlaceholderText("Sua senha"), "senha123");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(login).toHaveBeenCalled();
  });

  it("pede CNPJ quando o codigo e TENANT_CNPJ_REQUIRED", async () => {
    const user = userEvent.setup();
    login.mockRejectedValueOnce(Object.assign(new Error("informe o CNPJ"), { code: "TENANT_CNPJ_REQUIRED" }));
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    await user.type(screen.getByPlaceholderText("voce@loja.com"), "a@loja.com");
    await user.type(screen.getByPlaceholderText("Sua senha"), "senha123");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(await screen.findByLabelText(/cnpj da loja/i)).toBeInTheDocument();
  });
});
