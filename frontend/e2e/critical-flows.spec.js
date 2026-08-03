import { expect, test } from "@playwright/test";
import { API, DEMO_AUTH_FILE, ensureDemoAuthFile } from "./helpers.js";

function uniqueCnpj() {
  const stamp = String(Date.now()).slice(-10);
  const rnd = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
  return `${stamp}${rnd}`.slice(0, 14);
}

test.describe("fluxos criticos", () => {
  test.beforeAll(async ({ browser, request }) => {
    const health = await request.get(`${API}/health`);
    expect(health.ok(), "API precisa estar no ar (docker compose / backend)").toBeTruthy();
    await ensureDemoAuthFile(browser);
  });

  test("login com credenciais demo", async ({ browser }) => {
    const context = await browser.newContext({ storageState: DEMO_AUTH_FILE });
    const page = await context.newPage();
    await page.goto("/vendas");
    await expect(page.getByRole("heading", { name: "Vendas", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await context.close();
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

  test("apos login, PDV carrega busca de produtos", async ({ browser }) => {
    const context = await browser.newContext({ storageState: DEMO_AUTH_FILE });
    const page = await context.newPage();
    await page.goto("/vendas");
    await expect(page).toHaveURL(/\/vendas/);
    const barcode = page.locator("#sale-barcode-input");
    await expect(barcode).toBeVisible({ timeout: 15_000 });
    await context.close();
  });
});
