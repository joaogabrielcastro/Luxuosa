import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CashPage } from "../features/cash/CashPage.jsx";
import { CustomersPage } from "../features/customers/CustomersPage.jsx";
import { ProductsPage } from "../features/catalog/ProductsPage.jsx";
import { SettingsPage } from "../features/settings/SettingsPage.jsx";
import { ReportsPage } from "../features/reports/ReportsPage.jsx";
import { StockMovementsPage } from "../features/stock/StockMovementsPage.jsx";
import { StockAlertsPage } from "../features/stock/StockAlertsPage.jsx";
import { CrediarioPage } from "../features/crediario/CrediarioPage.jsx";
import { FiscalClosingPage } from "../features/fiscal/FiscalClosingPage.jsx";
import { BillingPage } from "../features/billing/BillingPage.jsx";
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
      hasNotaasApiKey: false,
      fiscal: { willEmitNfce: true, emitenteCnpjFormatado: "12.345.678/0001-99", message: "ok" }
    },
    refreshSession: vi.fn()
  })
}));

vi.mock("../shared/apiClient.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, apiClient };
});

describe("acoes das telas", () => {
  beforeEach(() => {
    apiClient.mockImplementation(mockApi);
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes("/fiscal-closing/summary")) return jsonResponse(FISCAL_SUMMARY);
      if (String(url).includes("/fiscal-closing/export")) {
        return {
          ok: true,
          headers: { get: () => 'attachment; filename="fechamento.zip"' },
          blob: async () => new Blob(["zip"]),
          json: async () => ({})
        };
      }
      return jsonResponse({ error: "nao mockado" }, false);
    });
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  it("abre caixa", async () => {
    const user = userEvent.setup();
    renderPage(<CashPage />);
    await screen.findByRole("heading", { level: 1, name: "Caixa" });
    await screen.findByText("Fechado");
    await user.click(await screen.findByRole("button", { name: "Abrir caixa" }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/cash/open", expect.objectContaining({ method: "POST" })));
  });

  it("cadastra cliente", async () => {
    const user = userEvent.setup();
    renderPage(<CustomersPage />);
    await screen.findByRole("heading", { level: 1, name: "Clientes" });
    await user.type(screen.getByPlaceholderText("Nome do cliente"), "Joao");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/customers", expect.objectContaining({ method: "POST" })));
  });

  it("salva produto", async () => {
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    await screen.findByRole("heading", { level: 1, name: "Produtos" });
    await user.type(screen.getByPlaceholderText("Nome"), "Calca");
    await user.selectOptions(screen.getByDisplayValue("Selecione categoria"), "cat1");
    await user.selectOptions(screen.getByDisplayValue("Selecione marca"), "br1");
    await user.click(screen.getByRole("button", { name: "Salvar produto" }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/products", expect.objectContaining({ method: "POST" })));
  });

  it("salva notaas e testa conexao", async () => {
    const user = userEvent.setup();
    renderPage(<SettingsPage />);
    await screen.findByRole("heading", { level: 1, name: "Configurações" });
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/invoices/notaas-config", expect.anything()));
  });

  it("exporta csv de relatorios", async () => {
    const user = userEvent.setup();
    renderPage(<ReportsPage />);
    await screen.findByRole("heading", { level: 1, name: "Relatórios" });
    await user.click((await screen.findAllByRole("button", { name: "Exportar CSV" }))[0]);
  });

  it("movimenta estoque", async () => {
    const user = userEvent.setup();
    renderPage(<StockMovementsPage />);
    await screen.findByRole("heading", { level: 1, name: "Movimentações" });
    await screen.findByText(/Camisa/i);
    await user.selectOptions(screen.getAllByRole("combobox")[0], "var1");
    await user.click(screen.getByRole("button", { name: /registrar/i }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/stock-movements", expect.objectContaining({ method: "POST" })));
  });

  it("salva alertas de estoque", async () => {
    const user = userEvent.setup();
    renderPage(<StockAlertsPage />);
    await screen.findByRole("heading", { level: 1, name: "Alertas de estoque" });
    await user.click(await screen.findByRole("button", { name: /salvar/i }));
    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith("/stock-alerts/settings", expect.objectContaining({ method: "PUT" }))
    );
  });

  it("abre detalhe e exclui crediario quitado", async () => {
    const user = userEvent.setup();
    renderPage(<CrediarioPage />);
    await screen.findAllByText("Maria Silva");
    await user.click(screen.getAllByRole("button", { name: "Detalhe" })[0]);
    expect(await screen.findByRole("dialog", { name: "Detalhe da venda a prazo" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getAllByRole("button", { name: "Excluir" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/crediario/cs1", expect.objectContaining({ method: "DELETE" })));
  });

  it("exporta fechamento fiscal", async () => {
    const user = userEvent.setup();
    renderPage(<FiscalClosingPage />);
    expect(await screen.findByText("NFC-e emitidas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /exportar pacote contábil/i }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  });

  it("mostra assinatura e aviso sem stripe", async () => {
    renderPage(<BillingPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Assinatura" })).toBeInTheDocument();
    expect(await screen.findByText(/pagamentos ainda não estão configurados/i)).toBeInTheDocument();
  });
});
