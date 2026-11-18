import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PosPage } from "./PosPage.jsx";
import { mockApi } from "../../../test/mockApi.js";
import { renderPage } from "../../../test/renderPage.jsx";

const { apiClient, authState } = vi.hoisted(() => ({
  apiClient: vi.fn(),
  authState: { userType: "ADMIN" }
}));

vi.mock("../../auth/useAuth.jsx", () => ({
  useAuth: () => ({
    token: "tok",
    user: { id: "u1", name: "Ana", type: authState.userType },
    tenant: { id: "t1", name: "Loja", cnpj: "12345678000199", plan: "PRO", enableNfceEmission: true }
  })
}));

vi.mock("../../../shared/apiClient.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, apiClient };
});

describe("PDV", () => {
  beforeEach(() => {
    authState.userType = "ADMIN";
    apiClient.mockReset();
    apiClient.mockImplementation(mockApi);
  });

  it("busca no servidor, escolhe tamanho/cor na grade e finaliza com o contrato da API", async () => {
    const user = userEvent.setup();
    const product = { id: "p1", name: "Camisa", sku: "CAM-01", price: 89.9, brand: { name: "Lux" } };
    apiClient.mockImplementation(async (path, opts) => {
      if (String(path).startsWith("/product-variations")) {
        return {
          items: [
            { id: "var1", productId: "p1", size: "M", color: "Preto", stock: 8, product },
            { id: "var2", productId: "p1", size: "G", color: "Preto", stock: 0, product }
          ],
          total: 2
        };
      }
      return mockApi(path, opts);
    });
    renderPage(<PosPage />, { route: "/vendas" });
    await screen.findByRole("heading", { level: 1, name: "Vender" });

    await user.type(screen.getByRole("searchbox", { name: /bipar etiqueta/i }), "camisa preto");
    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith(expect.stringMatching(/^\/product-variations\?.*q=camisa/), expect.anything())
    );
    await user.click(await screen.findByRole("button", { name: /camisa/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /^G/ })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: /^M/ }));
    await user.click(within(dialog).getByRole("button", { name: "Concluir" }));

    const cart = screen.getByRole("complementary", { name: "Carrinho" });
    expect(within(cart).getByText("Camisa")).toBeInTheDocument();
    await user.click(within(cart).getByRole("button", { name: /aumentar camisa/i }));
    await user.click(within(cart).getByRole("radio", { name: "Dinheiro" }));
    await user.type(within(cart).getByLabelText("Valor recebido em dinheiro"), "20000");
    expect(within(cart).getByText(/troco/i)).toBeInTheDocument();

    await user.click(within(cart).getByRole("button", { name: /finalizar venda/i }));
    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith(
        "/sales",
        expect.objectContaining({
          method: "POST",
          body: {
            paymentMethod: "CASH",
            installments: 1,
            discountValue: 0,
            discountPercent: 0,
            customerId: null,
            emitNfce: true,
            items: [{ productVariationId: "var1", quantity: 2, unitPrice: 89.9 }]
          }
        })
      )
    );
    expect(await screen.findByText("Venda concluída")).toBeInTheDocument();
    expect(screen.getByText(/troco:/i)).toBeInTheDocument();
  });

  it("adiciona pela leitura de código com Enter", async () => {
    const user = userEvent.setup();
    renderPage(<PosPage />, { route: "/vendas" });
    const input = await screen.findByRole("searchbox", { name: /bipar etiqueta/i });
    await user.type(input, "CAM-01{Enter}");
    const cart = screen.getByRole("complementary", { name: "Carrinho" });
    expect(await within(cart).findByText("Camisa")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("bloqueia desconto acima do limite do atendente", async () => {
    authState.userType = "ATTENDANT";
    const user = userEvent.setup();
    renderPage(<PosPage />, { route: "/vendas" });
    const input = await screen.findByRole("searchbox", { name: /bipar etiqueta/i });
    await user.type(input, "CAM-01{Enter}");
    const cart = screen.getByRole("complementary", { name: "Carrinho" });
    await within(cart).findByText("Camisa");
    await user.click(within(cart).getByRole("radio", { name: "%" }));
    await user.type(within(cart).getByLabelText("Desconto em porcentagem"), "15");
    expect(within(cart).getByText(/até 10% de desconto/i)).toBeInTheDocument();
    expect(within(cart).getByRole("button", { name: /finalizar venda/i })).toBeDisabled();
  });

  it("carrega venda para edição e salva com PUT", async () => {
    const user = userEvent.setup();
    renderPage(<PosPage />, { route: "/vendas?editar=sale1" });
    const cart = await screen.findByRole("complementary", { name: "Carrinho" });
    expect(await within(cart).findByText("Editando venda")).toBeInTheDocument();
    await user.click(within(cart).getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith("/sales/sale1", expect.objectContaining({ method: "PUT" }))
    );
  });
});
