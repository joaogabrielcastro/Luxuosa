import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.jsx";
import { mockApi } from "../test/mockApi.js";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn()
}));

vi.mock("../shared/apiClient.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, apiClient };
});

const session = {
  token: "tok",
  user: { id: "u1", name: "Admin", type: "ADMIN", email: "a@loja.com" },
  tenant: {
    id: "t1",
    name: "Loja Teste",
    cnpj: "12345678000199",
    plan: "PRO",
    enableNfceEmission: true,
    fiscal: { willEmitNfce: true, emitenteCnpjFormatado: "12.345.678/0001-99" }
  }
};

describe("App autenticado", () => {
  beforeEach(() => {
    apiClient.mockImplementation(async (path, opts) => {
      if (path === "/auth/me") return { user: session.user, tenant: session.tenant };
      return mockApi(path, opts);
    });
    localStorage.setItem("luxuosa_session", JSON.stringify(session));
  });

  it.each([
    ["/", "Início"],
    ["/vendas", "Vendas"],
    ["/catalog/products", "Produtos"],
    ["/catalog/variations", "Produtos"],
    ["/sales", "Vendas"],
    ["/stock", "Movimentações"],
    ["/reports", "Relatórios"],
    ["/fiscal", "Notas fiscais"],
    ["/vendas?aba=notas", "Notas fiscais"],
    ["/usuarios", "Usuários"],
    ["/caixa", "Caixa"],
    ["/estoque/alertas", "Alertas de estoque"],
    ["/configuracoes", "Configurações"],
    ["/assinatura", "Assinatura"],
    ["/crediario", "Crediário"],
    ["/clientes", "Clientes"],
    ["/fechamento-fiscal", "Fechamento fiscal"]
  ])("rota %s", async (path, title) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole("heading", { level: 1, name: title }, { timeout: 8000 })).toBeInTheDocument();
  }, 15000);
});
