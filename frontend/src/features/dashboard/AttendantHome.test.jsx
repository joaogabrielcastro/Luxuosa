import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardPage } from "./AdminDashboardPage.jsx";
import { mockApi } from "../../test/mockApi.js";
import { renderPage } from "../../test/renderPage.jsx";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn()
}));

vi.mock("../auth/useAuth.jsx", () => ({
  useAuth: () => ({
    token: "tok",
    user: { id: "u2", name: "Ana", type: "ATTENDANT", email: "ana@loja.com" },
    tenant: { id: "t1", name: "Loja", plan: "PRO", enableNfceEmission: true }
  })
}));

vi.mock("../../shared/apiClient.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, apiClient };
});

describe("inicio do atendente", () => {
  beforeEach(() => {
    apiClient.mockImplementation(mockApi);
  });

  it("mostra atalhos e alerta de estoque", async () => {
    renderPage(<AdminDashboardPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Início" })).toBeInTheDocument();
    expect(screen.getByText("Atalhos do dia: vender, receber fiado e conferir o que falta no estoque.")).toBeInTheDocument();
    expect(await screen.findByText(/produto\(s\) sem estoque/i)).toBeInTheDocument();
  });
});
