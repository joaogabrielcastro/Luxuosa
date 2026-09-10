import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardPage } from "../features/dashboard/AdminDashboardPage.jsx";
import { BillingPage } from "../features/billing/BillingPage.jsx";
import { BrandsPage } from "../features/catalog/BrandsPage.jsx";
import { CashPage } from "../features/cash/CashPage.jsx";
import { CategoriesPage } from "../features/catalog/CategoriesPage.jsx";
import { CrediarioPage } from "../features/crediario/CrediarioPage.jsx";
import { CustomersPage } from "../features/customers/CustomersPage.jsx";
import { FiscalClosingPage } from "../features/fiscal/FiscalClosingPage.jsx";
import { FiscalInvoicesPage } from "../features/fiscal/FiscalInvoicesPage.jsx";
import { NfeImportPage } from "../features/stock/NfeImportPage.jsx";
import { ProductsPage } from "../features/catalog/ProductsPage.jsx";
import { ReportsPage } from "../features/reports/ReportsPage.jsx";
import { SalesPage } from "../features/sales/NfceSalesPage.jsx";
import { SettingsPage } from "../features/settings/SettingsPage.jsx";
import { StockAlertsPage } from "../features/stock/StockAlertsPage.jsx";
import { StockMovementsPage } from "../features/stock/StockMovementsPage.jsx";
import { StockOverviewPage } from "../features/stock/StockOverviewPage.jsx";
import { UsersPage } from "../features/users/UsersPage.jsx";
import { FISCAL_SUMMARY, jsonResponse, mockApi } from "./mockApi.js";
import { renderPage } from "./renderPage.jsx";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn()
}));

vi.mock("../features/auth/useAuth.jsx", () => ({
  useAuth: () => ({
    token: "tok",
    user: { id: "u1", name: "Admin", type: "ADMIN", email: "a@loja.com" },
    tenant: {
      id: "t1",
      name: "Loja Teste",
      cnpj: "12345678000199",
      plan: "PRO",
      enableNfceEmission: true,
      notaasProjectId: "",
      fiscal: {
        willEmitNfce: true,
        emitenteCnpjFormatado: "12.345.678/0001-99",
        message: "Emissão ativa nesta loja."
      }
    },
    refreshSession: vi.fn(),
    logout: vi.fn()
  })
}));

vi.mock("../shared/apiClient.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiClient
  };
});

describe("Telas React", () => {
  beforeEach(() => {
    apiClient.mockImplementation(mockApi);
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes("/fiscal-closing/summary")) {
        return jsonResponse(FISCAL_SUMMARY);
      }
      return jsonResponse({ error: "nao mockado" }, false);
    });
  });

  const screens = [
    ["Início", AdminDashboardPage],
    ["Categorias", CategoriesPage],
    ["Marcas", BrandsPage],
    ["Produtos", ProductsPage],
    ["Vendas", SalesPage],
    ["Crediário", CrediarioPage],
    ["Clientes", CustomersPage],
    ["Usuários", UsersPage],
    ["Caixa", CashPage],
    ["Estoque", StockOverviewPage],
    ["Movimentações", StockMovementsPage],
    ["Alertas de estoque", StockAlertsPage],
    ["Entrada por NF-e (XML)", NfeImportPage],
    ["Relatórios", ReportsPage],
    ["Assinatura", BillingPage],
    ["Configurações", SettingsPage],
    ["Fechamento fiscal", FiscalClosingPage],
    ["Notas fiscais", FiscalInvoicesPage]
  ];

  it.each(screens)("renderiza %s", async (title, Page) => {
    renderPage(<Page />);
    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  });

  it("abre notas fiscais como aba de vendas", async () => {
    renderPage(<SalesPage />, { route: "/vendas?aba=notas" });
    expect(await screen.findByRole("heading", { level: 1, name: "Notas fiscais" })).toBeInTheDocument();
  });

  it("cadastra categoria pelo formulario", async () => {
    const user = userEvent.setup();
    renderPage(<CategoriesPage />);
    await screen.findByRole("heading", { level: 1, name: "Categorias" });
    await user.type(screen.getByPlaceholderText("Nome da categoria"), "Saias");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        "/categories",
        expect.objectContaining({ method: "POST", body: { name: "Saias" } })
      );
    });
  });

  it("valida novo usuario no modal", async () => {
    const user = userEvent.setup();
    renderPage(<UsersPage />);
    await screen.findByRole("heading", { level: 1, name: "Usuários" });
    await user.click(screen.getByRole("button", { name: "Novo usuário" }));
    expect(await screen.findByRole("dialog", { name: "Novo usuário" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/informe o nome/i)).toBeInTheDocument();
  });

  it("abre modal de nova venda a prazo no crediario", async () => {
    const user = userEvent.setup();
    renderPage(<CrediarioPage />);
    await screen.findByRole("heading", { level: 1, name: "Crediário" });
    expect(await screen.findAllByText("Maria Silva")).not.toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Nova venda a prazo" }));
    expect(await screen.findByRole("dialog", { name: "Nova venda a prazo" })).toBeInTheDocument();
  });
});
