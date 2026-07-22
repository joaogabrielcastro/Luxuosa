import { expect, test } from "@playwright/test";

const API = process.env.E2E_API_URL || "http://localhost:3001/api/v1";

async function loginAsDemoAdmin(page) {
  await page.goto("/login");
  await page.locator("#login-email").fill("admin@luxuosa.com");
  await page.locator("#login-password").fill("123456");
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page).toHaveURL(/\/vendas/, { timeout: 20_000 });
}

test.describe("fluxos da aplicacao", () => {
  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${API}/health`);
    expect(health.ok(), "API precisa estar no ar (docker compose / backend)").toBeTruthy();
  });

  test("login → catalogo produtos visivel", async ({ page }) => {
    await loginAsDemoAdmin(page);
    await page.goto("/catalog/products");
    await expect(page.getByRole("heading", { name: "Produtos", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText("Lista de produtos")).toBeVisible();
  });

  test("login → pagina Clientes", async ({ page }) => {
    await loginAsDemoAdmin(page);
    await page.goto("/clientes");
    await expect(page.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible({
      timeout: 15_000
    });
  });

  test("login → Relatorios com inputs de data", async ({ page }) => {
    await loginAsDemoAdmin(page);
    await page.goto("/relatorios");
    await expect(page.getByRole("heading", { name: "Relatórios", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator('input[type="date"]')).toHaveCount(2);
  });

  test("login → Assinatura mostra planos", async ({ page }) => {
    await loginAsDemoAdmin(page);
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
    await loginAsDemoAdmin(page);
    await page.goto("/usuarios");
    await expect(page.getByRole("heading", { name: "Usuários", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText(/Lista de usuários|Novo usuário/i).first()).toBeVisible();
  });

  test("login → Estoque movimentos", async ({ page }) => {
    await loginAsDemoAdmin(page);
    await page.goto("/estoque/movimentos");
    await expect(
      page.getByRole("heading", { name: "Ajustar estoque", exact: true })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Nova movimentação")).toBeVisible();
  });
});
