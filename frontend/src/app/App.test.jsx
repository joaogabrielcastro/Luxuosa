import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App.jsx";

vi.mock("../shared/apiClient.js", () => ({
  apiClient: vi.fn(),
  AUTH_UNAUTHORIZED_EVENT: "luxuosa:unauthorized",
  apiBaseUrl: "http://localhost:3001/api/v1"
}));

describe("App rotas", () => {
  it("abre login sem sessao", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });

  it("rota privada redireciona para login", () => {
    render(
      <MemoryRouter initialEntries={["/vendas"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });
});
