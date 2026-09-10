import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardPage } from "../features/dashboard/AdminDashboardPage.jsx";
import { BillingPage } from "../features/billing/BillingPage.jsx";
import { BrandsPage } from "../features/catalog/BrandsPage.jsx";
import { CashPage } from "../features/cash/CashPage.jsx";
import { CrediarioPage } from "../features/crediario/CrediarioPage.jsx";
import { CustomersPage } from "../features/customers/CustomersPage.jsx";
import { FiscalInvoicesPage } from "../features/fiscal/FiscalInvoicesPage.jsx";
import { ProductsPage } from "../features/catalog/ProductsPage.jsx";
import { ReportsPage } from "../features/reports/ReportsPage.jsx";
import { SettingsPage } from "../features/settings/SettingsPage.jsx";
import { StockAlertsPage } from "../features/stock/StockAlertsPage.jsx";
import { StockOverviewPage } from "../features/stock/StockOverviewPage.jsx";
import { UsersPage } from "../features/users/UsersPage.jsx";
import { jsonResponse, mockApi } from "./mockApi.js";
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
      hasNotaasApiKey: true,
      notaasProjectId: "proj1",
      fiscal: { willEmitNfce: true, emitenteCnpjFormatado: "12.345.678/0001-99", message: "ok" }
    },
    refreshSession: vi.fn()
  })
}));

vi.mock("../shared/apiClient.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, apiClient };
});

describe("fluxos profundos", () => {
  beforeEach(() => {
    apiClient.mockImplementation(mockApi);
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes("/invoices/sale/")) {
        return {
          ok: true,
          headers: { get: () => "application/pdf" },
          blob: async () => new Blob(["pdf"]),
          json: async () => ({})
        };
      }
      if (String(url).includes("viacep")) {
        return jsonResponse({
          erro: false,
          logradouro: "Rua A",
          bairro: "Centro",
          localidade: "Sao Paulo",
          uf: "SP"
        });
      }
      return jsonResponse({ error: "nao mockado" }, false);
    });
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  it("dashboard troca periodo", async () => {
    const user = userEvent.setup();
    renderPage(<AdminDashboardPage />);
    expect(await screen.findAllByText("Camisa")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Hoje" }));
    await user.click(screen.getByRole("button", { name: "Esta semana" }));
    await user.click(screen.getByRole("button", { name: "Últimos 30 dias" }));
    expect(screen.getByText("Desempenho da equipe")).toBeInTheDocument();
  });

  it("cadastra e edita usuario", async () => {
    const user = userEvent.setup();
    renderPage(<UsersPage />);
    await screen.findByRole("heading", { level: 1, name: "Usuários" });
    await user.click(screen.getByRole("button", { name: "Novo usuário" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/informe o nome/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Nome completo"), "Ana");
    await user.type(screen.getByPlaceholderText("usuario@loja.com"), "ana@loja.com");
    await user.type(screen.getByPlaceholderText("Mínimo 6 caracteres"), "secret1");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/users", expect.objectContaining({ method: "POST" })));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    expect(await screen.findByRole("heading", { name: "Editar usuário" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/users/u1", expect.objectContaining({ method: "PUT" })));
    await user.click(screen.getAllByRole("button", { name: "Excluir" }).find((btn) => !btn.disabled));
    await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/users/u2", expect.objectContaining({ method: "DELETE" })));
  });

  it("fecha caixa aberto e mostra historico", async () => {
    const user = userEvent.setup();
    apiClient.mockImplementation(async (path, opts) => {
      if (String(path).split("?")[0] === "/cash/current") {
        return {
          session: {
            id: "cash1",
            status: "OPEN",
            openingFloat: 50,
            openedAt: "2026-09-10T10:00:00.000Z",
            openedBy: { name: "Admin" }
          },
          preview: {
            saleCount: 2,
            totalAmount: 100,
            expectedCash: 80,
            expectedDrawer: 130,
            totalsByMethod: { CASH: 50, PIX: 50 }
          }
        };
      }
      return mockApi(path, opts);
    });
    renderPage(<CashPage />);
    await screen.findAllByText("Aberto");
    await user.type(screen.getByRole("spinbutton"), "80");
    await user.click(screen.getByRole("button", { name: "Fechar caixa" }));
    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith("/cash/cash1/close", expect.objectContaining({ method: "POST" }))
    );
    expect(screen.getByText("Histórico")).toBeInTheDocument();
  });

  it("baixa pdf e tenta nfc-e nas notas", async () => {
    const user = userEvent.setup();
    renderPage(<FiscalInvoicesPage />);
    await screen.findByRole("heading", { level: 1, name: "Notas fiscais" });
    await user.click(await screen.findByRole("button", { name: "Baixar PDF" }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /emitir \/ tentar de novo/i }));
    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith("/invoices/issue/sale-err", expect.objectContaining({ method: "POST" }))
    );
  });

  it("recebe e cancela crediario em aberto", async () => {
    const user = userEvent.setup();
    renderPage(<CrediarioPage />);
    await screen.findAllByText("Maria Silva");
    await user.click(screen.getByRole("button", { name: "Receber" }));
    await user.click(await screen.findByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith("/crediario/cs-open/payments", expect.objectContaining({ method: "POST" }))
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(await screen.findByRole("button", { name: "Cancelar venda" }));
    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith("/crediario/cs-open/cancel", expect.objectContaining({ method: "POST" }))
    );
  });

  it("cria venda a prazo", async () => {
    const user = userEvent.setup();
    renderPage(<CrediarioPage />);
    await screen.findAllByText("Maria Silva");
    await user.click(screen.getByRole("button", { name: "Nova venda a prazo" }));
    await user.selectOptions(screen.getByDisplayValue("Selecione..."), "cust1");
    await user.selectOptions(screen.getByDisplayValue("Variacao..."), "var1");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/crediario", expect.objectContaining({ method: "POST" })));
  });

  it("edita cliente e busca cep", async () => {
    const user = userEvent.setup();
    renderPage(<CustomersPage />);
    await screen.findByRole("heading", { level: 1, name: "Clientes" });
    await screen.findByText("Maria Silva");
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.type(screen.getByPlaceholderText("00000-000"), "01310100");
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/customers/cust1", expect.objectContaining({ method: "PUT" })));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/customers/cust1", expect.objectContaining({ method: "DELETE" })));
  });

  it("edita produto, aplica sku e exclui", async () => {
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    await screen.findByRole("heading", { level: 1, name: "Produtos" });
    await screen.findByText("Camisa");
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.type(screen.getByPlaceholderText("Bipar e pressionar Enter"), "CAM-99");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    await user.click(screen.getByRole("button", { name: "Atualizar produto" }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/products/p1", expect.objectContaining({ method: "PUT" })));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/products/p1", expect.objectContaining({ method: "DELETE" })));
  });

  it("edita e exclui marca", async () => {
    const user = userEvent.setup();
    renderPage(<BrandsPage />);
    await screen.findByRole("heading", { level: 1, name: "Marcas" });
    await screen.findByText("Lux");
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/brands/br1", expect.objectContaining({ method: "PUT" })));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/brands/br1", expect.objectContaining({ method: "DELETE" })));
  });

  it("testa conexao notaas", async () => {
    const user = userEvent.setup();
    renderPage(<SettingsPage />);
    await screen.findByRole("heading", { level: 1, name: "Configurações" });
    await user.click(screen.getByRole("button", { name: "Testar conexão" }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/invoices/connection-test", expect.anything()));
    expect(await screen.findByText(/homologacao/i)).toBeInTheDocument();
  });

  it("exporta estoque baixo e dispara alerta", async () => {
    const user = userEvent.setup();
    renderPage(<ReportsPage />);
    await screen.findByRole("heading", { level: 1, name: "Relatórios" });
    await user.click((await screen.findAllByRole("button", { name: "Exportar CSV" }))[1]);
    renderPage(<StockAlertsPage />);
    await user.click(await screen.findByRole("button", { name: "Verificar agora" }));
    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith("/stock-alerts/run", expect.objectContaining({ method: "POST" }))
    );
  });

  it("mostra estoque baixo na visao geral", async () => {
    renderPage(<StockOverviewPage />);
    expect(await screen.findAllByText("Camisa")).toBeTruthy();
  });

  it("checkout stripe quando configurado", async () => {
    const user = userEvent.setup();
    apiClient.mockImplementation(async (path, opts) => {
      if (String(path).split("?")[0] === "/billing/status") {
        return {
          configured: true,
          currentPlan: "PRO",
          hasStripeCustomer: true,
          subscriptionStatus: "active",
          planPeriodEnd: "2026-10-01T00:00:00.000Z",
          plans: [
            { id: "BASIC", name: "Básico", description: "Essencial", priceLabel: "Grátis", features: ["PDV"], current: false },
            { id: "PRO", name: "Pro", description: "Notas", priceLabel: "R$ 99", features: ["NFC-e"], current: true },
            { id: "ENTERPRISE", name: "Enterprise", description: "Completo", priceLabel: "R$ 250", features: ["Tudo"], current: false }
          ]
        };
      }
      return mockApi(path, opts);
    });
    const loc = { href: "http://localhost/" };
    vi.stubGlobal("location", loc);
    renderPage(<BillingPage />);
    await user.click(await screen.findByRole("button", { name: /assinar enterprise/i }));
    await waitFor(() => expect(loc.href).toContain("stripe.test/checkout"));
    await user.click(screen.getByRole("button", { name: /gerenciar pagamento/i }));
    await waitFor(() => expect(loc.href).toContain("stripe.test/portal"));
  });

  it("sincroniza plano apos checkout success", async () => {
    renderPage(<BillingPage />, { route: "/assinatura?checkout=success" });
    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith("/billing/sync", expect.objectContaining({ method: "POST" }))
    );
  });
});
