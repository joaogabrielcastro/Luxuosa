import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductVariationsSection } from "./ProductVariationsSection.jsx";
import { renderPage } from "../../test/renderPage.jsx";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn()
}));

vi.mock("../../shared/apiClient.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, apiClient };
});

describe("ProductVariationsSection", () => {
  beforeEach(() => {
    apiClient.mockReset();
    apiClient.mockImplementation(async (path, opts = {}) => {
      if ((opts.method || "GET") === "GET") {
        return {
          items: [
            { id: "def", size: "", color: "", stock: 2 },
            { id: "v1", size: "M", color: "Preto", stock: 3 }
          ]
        };
      }
      return { ok: true };
    });
  });

  it("pede para salvar produto primeiro", () => {
    renderPage(<ProductVariationsSection token="t" productId="" />);
    expect(screen.getByText(/salve o produto primeiro/i)).toBeInTheDocument();
  });

  it("lista, cria e exclui variacao", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderPage(<ProductVariationsSection token="t" productId="p1" productName="Camisa" onChanged={onChanged} />);
    expect(await screen.findByText("Tamanho/cor")).toBeInTheDocument();
    expect(screen.getByText("Estoque geral")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Tamanho"), "G");
    await user.type(screen.getByPlaceholderText("Cor"), "Azul");
    await user.type(screen.getByPlaceholderText("Estoque"), "4");
    await user.click(screen.getByRole("button", { name: /adicionar variacao/i }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/product-variations", expect.objectContaining({ method: "POST" })));
    await user.click(screen.getAllByRole("button", { name: "Excluir" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
