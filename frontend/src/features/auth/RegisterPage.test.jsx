import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "./RegisterPage.jsx";

const { apiClient, acceptSession } = vi.hoisted(() => ({
  apiClient: vi.fn(),
  acceptSession: vi.fn()
}));

vi.mock("./useAuth.jsx", () => ({
  useAuth: () => ({ token: null, acceptSession })
}));

vi.mock("../../shared/apiClient.js", () => ({
  apiClient
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    apiClient.mockReset();
    acceptSession.mockReset();
  });

  it("exige CNPJ com 14 digitos", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /criar conta e entrar/i }));
    expect(await screen.findByText(/cnpj com 14 digitos/i)).toBeInTheDocument();
  });

  it("valida campos e registra loja", async () => {
    const user = userEvent.setup();
    apiClient.mockResolvedValue({ token: "tok", user: { id: "u1" } });
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    await user.type(screen.getByLabelText(/cnpj/i), "12345678000199");
    await user.click(screen.getByRole("button", { name: /criar conta e entrar/i }));
    expect(await screen.findByText(/informe o nome da loja/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Minha Loja"), "Loja Nova");
    await user.click(screen.getByRole("button", { name: /criar conta e entrar/i }));
    expect(await screen.findByText(/informe o nome do administrador/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Nome completo"), "Joao Admin");
    await user.click(screen.getByRole("button", { name: /criar conta e entrar/i }));
    expect(await screen.findByText(/senha deve ter no minimo 6/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Mínimo 6 caracteres"), "secret1");
    await user.type(screen.getByPlaceholderText("contato@loja.com"), "loja@loja.com");
    await user.type(screen.getByPlaceholderText("voce@loja.com"), "joao@loja.com");
    await user.type(screen.getByPlaceholderText("Com DDD (opcional)"), "11988887777");
    await user.click(screen.getByRole("button", { name: /mostrar senha/i }));
    await user.click(screen.getByRole("button", { name: /criar conta e entrar/i }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/auth/register", expect.objectContaining({ method: "POST" })));
    expect(acceptSession).toHaveBeenCalled();
  });
});
