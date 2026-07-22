import { expect, test } from "@playwright/test";

const API = process.env.E2E_API_URL || "http://localhost:3001/api/v1";

function uniqueCnpj() {
  const stamp = String(Date.now()).slice(-10);
  const rnd = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
  return `${stamp}${rnd}`.slice(0, 14);
}

test.describe("fluxos criticos", () => {
  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${API}/health`);
    expect(health.ok(), "API precisa estar no ar (docker compose / backend)").toBeTruthy();
  });

  test("login com credenciais demo", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-email").fill("admin@luxuosa.com");
    await page.locator("#login-password").fill("123456");
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await expect(page).toHaveURL(/\/vendas/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Vendas", exact: true })).toBeVisible();
  });

  test("cadastro self-serve cria loja e entra", async ({ page }) => {
    const cnpj = uniqueCnpj();
    const email = `e2e.admin.${Date.now()}@luxuosa.test`;

    await page.goto("/cadastro");
    await page.locator("#reg-tenant-name").fill(`E2E Loja ${cnpj.slice(-4)}`);
    await page.locator("#reg-cnpj").fill(cnpj);
    await page.locator("#reg-tenant-email").fill(`e2e.loja.${Date.now()}@luxuosa.test`);
    await page.locator("#reg-admin-name").fill("Admin E2E");
    await page.locator("#reg-admin-email").fill(email);
    await page.locator("#reg-admin-password").fill("senha123");
    await page.getByRole("button", { name: /criar conta e entrar/i }).click();
    await expect(page).toHaveURL(/\/vendas/, { timeout: 25_000 });
  });

  test("apos login, PDV carrega busca de produtos", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-email").fill("admin@luxuosa.com");
    await page.locator("#login-password").fill("123456");
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await expect(page).toHaveURL(/\/vendas/);

    const barcode = page.locator("#sale-barcode-input");
    await expect(barcode).toBeVisible({ timeout: 15_000 });
  });
});
