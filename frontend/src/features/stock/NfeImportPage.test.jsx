import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NfeImportPage } from "./NfeImportPage.jsx";
import { mockApi, NFE_PREVIEW } from "../../test/mockApi.js";
import { renderPage } from "../../test/renderPage.jsx";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn()
}));

vi.mock("../auth/useAuth.jsx", () => ({
  useAuth: () => ({
    token: "tok",
    user: { id: "u1", name: "Admin", type: "ADMIN" },
    tenant: { id: "t1", name: "Loja", plan: "PRO", enableNfceEmission: true }
  })
}));

vi.mock("../../shared/apiClient.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, apiClient };
});

describe("NfeImportPage", () => {
  beforeEach(() => {
    apiClient.mockImplementation(mockApi);
  });

  it("lê XML, revisa e confirma", async () => {
    const user = userEvent.setup();
    renderPage(<NfeImportPage />);
    await screen.findByRole("heading", { level: 1, name: "Entrada por NF-e (XML)" });
    const file = new File(["<nfe/>"], "nota.xml", { type: "text/xml" });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /ler nota e continuar/i }));
    expect(await screen.findByText("Confirmar e atualizar estoque")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Categoria (itens novos)"), "cat1");
    await user.selectOptions(screen.getByLabelText("Marca (itens novos)"), "br1");
    await user.click(screen.getByRole("button", { name: /aplicar em todos os itens novos/i }));
    await user.click(screen.getByRole("button", { name: /confirmar e atualizar estoque/i }));
    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith("/nfe-imports/confirm", expect.objectContaining({ method: "POST" }));
    });
    expect(await screen.findByText(/importacao concluida/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ver detalhes/i }));
    expect(await screen.findByRole("dialog", { name: "Detalhes da importacao" })).toBeInTheDocument();
  });

  it("abre historico", async () => {
    const user = userEvent.setup();
    renderPage(<NfeImportPage />);
    await user.click(await screen.findByRole("button", { name: /historico de nf-e/i }));
    expect(await screen.findByText("Fornecedor SA")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "10/1" }));
    expect(await screen.findByRole("dialog", { name: "Detalhes da importacao" })).toBeInTheDocument();
    expect(screen.getAllByText("Camisa polo").length).toBeGreaterThan(0);
  });

  it("preview 402 marca plano", async () => {
    const { ApiError } = await import("../../shared/apiClient.js");
    apiClient.mockImplementation(async (path, opts = {}) => {
      if (path === "/nfe-imports/preview") {
        throw new ApiError("Plano", { status: 402, code: "PLAN_UPGRADE_REQUIRED" });
      }
      return mockApi(path, opts);
    });
    const user = userEvent.setup();
    renderPage(<NfeImportPage />);
    const file = new File(["<nfe/>"], "nota.xml", { type: "text/xml" });
    await user.upload(document.querySelector('input[type="file"]'), file);
    await user.click(screen.getByRole("button", { name: /ler nota e continuar/i }));
    expect(await screen.findByText(/plano pro necessario/i)).toBeInTheDocument();
  });

  it("vincula, ignora e recria item na revisao", async () => {
    apiClient.mockImplementation(async (path, opts) => {
      if (path === "/nfe-imports/preview") {
        return {
          ...NFE_PREVIEW,
          items: [
            {
              ...NFE_PREVIEW.items[0],
              matchStatus: "MATCHED",
              suggestedAction: "link",
              matchedProduct: {
                id: "p1",
                name: "Camisa",
                price: 89.9,
                variationId: "var1",
                variations: [{ id: "var1", size: "M", color: "Preto", stock: 8 }]
              }
            }
          ]
        };
      }
      return mockApi(path, opts);
    });
    const user = userEvent.setup();
    renderPage(<NfeImportPage />);
    const file = new File(["<nfe/>"], "nota.xml", { type: "text/xml" });
    await user.upload(document.querySelector('input[type="file"]'), file);
    await user.click(screen.getByRole("button", { name: /ler nota e continuar/i }));
    await user.click(await screen.findByRole("button", { name: /vincular/i }));
    await user.click(screen.getByText(/atualizar custo/i));
    await user.click(screen.getByText(/atualizar preco/i));
    expect(screen.getByText(/preco venda/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ignorar/i }));
    await user.click(screen.getByRole("button", { name: /criar novo/i }));
    expect(screen.getByText(/nome/i)).toBeInTheDocument();
  });
});
