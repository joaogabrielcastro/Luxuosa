import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductsPage } from "./ProductsPage.jsx";
import { mockApi } from "../../test/mockApi.js";
import { renderPage } from "../../test/renderPage.jsx";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn()
}));

vi.mock("../auth/useAuth.jsx", () => ({
  useAuth: () => ({
    token: "tok",
    user: { id: "u1", name: "Admin", type: "ADMIN" },
    tenant: { id: "t1", name: "Loja", plan: "PRO" }
  })
}));

vi.mock("../../shared/apiClient.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, apiClient };
});

describe("ProductsPage — cadastro com tamanho e cor", () => {
  beforeEach(() => {
    apiClient.mockImplementation(mockApi);
  });

  it("mostra tamanho e cor no novo produto, sem precisar salvar antes", async () => {
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    await screen.findByRole("heading", { level: 1, name: "Produtos" });
    expect(screen.queryByPlaceholderText("P, M, 38...")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /tamanhos e cores/i }));

    expect(screen.getByPlaceholderText("P, M, 38...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Preto, azul...")).toBeInTheDocument();
    expect(screen.queryByText(/salve o produto/i)).not.toBeInTheDocument();
  });

  it("salva o produto e as combinações no mesmo envio", async () => {
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    await screen.findByRole("heading", { level: 1, name: "Produtos" });
    await user.type(screen.getByPlaceholderText("Nome"), "Calca");
    await user.selectOptions(screen.getByDisplayValue("Selecione categoria"), "cat1");
    await user.selectOptions(screen.getByDisplayValue("Selecione marca"), "br1");
    await user.click(screen.getByRole("radio", { name: /tamanhos e cores/i }));

    await user.type(screen.getByLabelText("Tamanho 1"), "M");
    await user.type(screen.getByLabelText("Cor 1"), "Preto");
    await user.type(screen.getByLabelText("Quantidade 1"), "3");
    await user.click(screen.getByRole("button", { name: /adicionar outra linha/i }));
    await user.type(screen.getByLabelText("Tamanho 2"), "G");
    await user.type(screen.getByLabelText("Cor 2"), "Azul");
    await user.type(screen.getByLabelText("Quantidade 2"), "1");
    await user.click(screen.getByRole("button", { name: "Salvar produto" }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith("/products", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      const variationCalls = apiClient.mock.calls.filter(
        ([path, opts]) => path === "/product-variations" && opts?.method === "POST"
      );
      expect(variationCalls).toEqual(
        expect.arrayContaining([
          [
            "/product-variations",
            expect.objectContaining({
              method: "POST",
              body: expect.objectContaining({ productId: "p-new", size: "M", color: "Preto", stock: 3 })
            })
          ],
          [
            "/product-variations",
            expect.objectContaining({
              method: "POST",
              body: expect.objectContaining({ productId: "p-new", size: "G", color: "Azul", stock: 1 })
            })
          ]
        ])
      );
    });
  });
});
