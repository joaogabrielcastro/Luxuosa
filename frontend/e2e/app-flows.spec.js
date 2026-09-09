import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { API, DEMO_AUTH_FILE, ensureDemoAuthFile } from "./helpers.js";

if (!fs.existsSync(DEMO_AUTH_FILE)) {
  fs.writeFileSync(DEMO_AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
}

test.describe("fluxos da aplicacao", () => {
  test.beforeAll(async ({ browser, request }) => {
    const health = await request.get(`${API}/health`);
    expect(health.ok(), "API precisa estar no ar (docker compose / backend)").toBeTruthy();
    await ensureDemoAuthFile(browser);
  });

  test.use({ storageState: DEMO_AUTH_FILE });

  test("login → catalogo produtos visivel", async ({ page }) => {
    await page.goto("/catalog/products");
    await expect(page.getByRole("heading", { name: "Produtos", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText("Lista de produtos")).toBeVisible();
  });

  test("login → pagina Clientes", async ({ page }) => {
    await page.goto("/clientes");
    await expect(page.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible({
      timeout: 15_000
    });
  });

  test("login → Relatorios com inputs de data", async ({ page }) => {
    await page.goto("/relatorios");
    await expect(page.getByRole("heading", { name: "Relatórios", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator('input[type="date"]')).toHaveCount(2);
  });

  test("login → Assinatura mostra planos", async ({ page }) => {
    await page.goto("/assinatura");
    await expect(page.getByRole("heading", { name: "Assinatura", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole("heading", { name: "Basico", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
  });

  test("login → Usuarios (admin)", async ({ page }) => {
    await page.goto("/usuarios");
    await expect(page.getByRole("heading", { name: "Usuários", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText(/Lista de usuários|Novo usuário/i).first()).toBeVisible();
  });

  test("login → Estoque movimentos", async ({ page }) => {
    await page.goto("/estoque/movimentos");
    await expect(
      page.getByRole("heading", { name: "Movimentações", exact: true })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Nova movimentação")).toBeVisible();
  });
});
