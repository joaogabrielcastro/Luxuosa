import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
  API,
  apiJson,
  ensureCatalog,
  forcePlanPro,
  loginAsDemoAdmin,
  loginWithSession,
  registerFreshTenant,
  sessionToken
} from "./helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_NFE = path.resolve(__dirname, "../../backend/src/shared/fixtures/sample-nfe.xml");
const AUTH_FILE = path.join(__dirname, ".auth-demo-admin.json");

// Placeholder para o Playwright carregar storageState antes do beforeAll gravar a sessao real.
if (!fs.existsSync(AUTH_FILE)) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
}

test.describe("fluxos profundos", () => {
  test.setTimeout(90_000);

  test.beforeAll(async ({ browser, request }) => {
    const health = await request.get(`${API}/health`);
    expect(health.ok(), "API precisa estar no ar (docker compose / backend)").toBeTruthy();

    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsDemoAdmin(page);
    await context.storageState({ path: AUTH_FILE });
    await context.close();
  });

  test.use({ storageState: AUTH_FILE });

  test("venda completa via API setup + UI finalizar", async ({ page, request }) => {
    await page.goto("/vendas");
    await expect(page.getByRole("heading", { name: "Vendas", exact: true })).toBeVisible({
      timeout: 15_000
    });
    const token = await sessionToken(page);
    const catalog = await ensureCatalog(request, token, { stock: 15, price: 39.9, forceNew: true });

    await page.goto("/vendas");
    await expect(page.getByRole("heading", { name: "Vendas", exact: true })).toBeVisible({
      timeout: 15_000
    });

    await expect(
      page.locator("label").filter({ hasText: "Categoria" }).locator("option").nth(1)
    ).toBeAttached({ timeout: 20_000 });

    const barcode = page.locator("#sale-barcode-input");
    await expect(barcode).toBeVisible({ timeout: 15_000 });
    await barcode.fill(catalog.sku);
    await barcode.press("Enter");

    await expect(page.getByRole("button", { name: /Remover/i }).first()).toBeVisible({
      timeout: 15_000
    });

    const nfce = page.getByLabel(/Emitir nota fiscal/i);
    if (await nfce.count()) {
      await nfce.uncheck();
    }

    await page.getByRole("button", { name: /Finalizar venda/i }).click();
    await expect(page.getByText(/Venda criada/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("caixa abrir e fechar", async ({ page }) => {
    await page.goto("/caixa");
    await expect(page.getByRole("heading", { name: "Caixa", exact: true })).toBeVisible({
      timeout: 15_000
    });

    await expect(page.getByText(/^Aberto$|^Fechado$/).first()).toBeVisible({ timeout: 15_000 });

    if (await page.getByRole("button", { name: /Fechar caixa/i }).isVisible()) {
      await page.getByLabel(/Valor contado/i).fill("0");
      await page.getByRole("button", { name: /Fechar caixa/i }).click();
      await expect(page.getByText(/Caixa fechado/i).first()).toBeVisible({
        timeout: 15_000
      });
    }

    await expect(page.getByRole("button", { name: /Abrir caixa/i })).toBeVisible({
      timeout: 15_000
    });
    await page.getByRole("button", { name: /Abrir caixa/i }).click();
    await expect(page.getByText(/Caixa aberto|Aberto/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Aberto").first()).toBeVisible();

    await page.getByLabel(/Valor contado/i).fill("0");
    await page.getByRole("button", { name: /Fechar caixa/i }).click();
    await expect(page.getByText(/Caixa fechado/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Fechado").first()).toBeVisible();
  });

  test("ajustar estoque ENTRY", async ({ page, request }) => {
    await page.goto("/vendas");
    const token = await sessionToken(page);
    await ensureCatalog(request, token, { stock: 5 });

    await page.goto("/estoque/movimentos");
    await expect(
      page.getByRole("heading", { name: "Ajustar estoque", exact: true })
    ).toBeVisible({ timeout: 15_000 });

    const variationSelect = page.locator("form select").first();
    await expect(variationSelect.locator("option").nth(1)).toBeAttached({ timeout: 15_000 });
    const value = await variationSelect.locator("option").nth(1).getAttribute("value");
    await variationSelect.selectOption(value);

    await page.locator("form select").nth(1).selectOption("ENTRY");
    await page.locator('form input[type="number"]').fill("1");
    await page.getByRole("button", { name: /^Registrar$/i }).click();

    await expect(page.getByText(/Entrada registrada/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("crediario criar venda e receber pagamento", async ({ page, request }) => {
    await page.goto("/vendas");
    const token = await sessionToken(page);
    const catalog = await ensureCatalog(request, token, { stock: 10, price: 50, forceNew: true });
    const customer = await apiJson(request, "/customers", {
      method: "POST",
      token,
      body: { name: `E2E Cred ${Date.now()}`, cpfCnpj: "11144477735" }
    });
    expect(customer.ok).toBeTruthy();

    await page.goto("/crediario");
    await expect(page.getByRole("heading", { name: "Crediário", exact: true })).toBeVisible({
      timeout: 15_000
    });

    await page.getByRole("button", { name: /Nova venda a prazo/i }).click();
    await expect(page.getByRole("heading", { name: /Nova venda a prazo/i })).toBeVisible({
      timeout: 10_000
    });

    const modal = page.locator('[role="dialog"]').filter({ hasText: /Nova venda a prazo/i });
    await modal.locator("select").first().selectOption(customer.data.id);
    await modal.locator("select").nth(1).selectOption(catalog.variationId);
    await modal.getByPlaceholder("Qtd").fill("1");
    await modal.getByRole("button", { name: /^Salvar$/i }).click();
    await expect(page.getByText(/Venda a prazo registrada/i).first()).toBeVisible({
      timeout: 15_000
    });

    await page.getByRole("button", { name: /^Receber$/i }).first().click();
    await expect(page.getByRole("heading", { name: /Registrar recebimento/i })).toBeVisible({
      timeout: 10_000
    });
    const payModal = page.locator('[role="dialog"]').filter({ hasText: /Registrar recebimento/i });
    await payModal.locator("input").first().fill("10,00");
    await payModal.getByRole("button", { name: /^Confirmar$/i }).click();
    await expect(page.getByText(/Pagamento registrado/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("relatorios export CSV", async ({ page, request }) => {
    await page.goto("/vendas");
    const token = await sessionToken(page);
    const catalog = await ensureCatalog(request, token, { stock: 8, price: 25 });

    await apiJson(request, "/sales", {
      method: "POST",
      token,
      body: {
        paymentMethod: "PIX",
        installments: 1,
        emitNfce: false,
        items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: catalog.price }]
      }
    });

    await page.goto("/relatorios");
    await expect(page.getByRole("heading", { name: "Relatórios", exact: true })).toBeVisible({
      timeout: 15_000
    });

    const exportBtn = page.getByRole("button", { name: /Exportar CSV/i }).first();
    await expect(exportBtn).toBeEnabled({ timeout: 20_000 });

    const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
    await exportBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test("cadastro cliente via UI", async ({ page }) => {
    await page.goto("/clientes");
    await expect(page.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible({
      timeout: 15_000
    });
    const name = `Cliente E2E ${Date.now()}`;
    await page.getByPlaceholder("Nome do cliente").fill(name);
    await page.getByRole("button", { name: /^Salvar$/i }).click();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
  });

  test("cadastro usuario atendente via UI", async ({ page }) => {
    await page.goto("/usuarios");
    await expect(page.getByRole("heading", { name: "Usuários", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await page.getByRole("button", { name: /Novo usuário/i }).click();
    await expect(page.getByRole("heading", { name: /Novo usuário/i })).toBeVisible({
      timeout: 10_000
    });
    const email = `atendente.e2e.${Date.now()}@luxuosa.test`;
    const modal = page.locator('[role="dialog"]').filter({ hasText: /Novo usuário/i });
    await modal.getByPlaceholder("Nome completo").fill("Atendente E2E");
    await modal.getByPlaceholder("usuario@loja.com").fill(email);
    await modal.getByPlaceholder("Mínimo 6 caracteres").fill("senha123");
    await modal.getByRole("button", { name: /^Salvar$/i }).click();
    await expect(page.getByText(email).first()).toBeVisible({ timeout: 15_000 });
  });

  test("cadastro produto com categoria e marca", async ({ page, request }) => {
    await page.goto("/vendas");
    const token = await sessionToken(page);
    const stamp = Date.now();
    const cat = await apiJson(request, "/categories", {
      method: "POST",
      token,
      body: { name: `UI Cat ${stamp}` }
    });
    const brand = await apiJson(request, "/brands", {
      method: "POST",
      token,
      body: { name: `UI Marca ${stamp}` }
    });
    expect(cat.ok && brand.ok).toBeTruthy();

    await page.goto("/catalog/products");
    await expect(page.getByRole("heading", { name: "Produtos", exact: true })).toBeVisible({
      timeout: 15_000
    });
    const productName = `Produto UI ${stamp}`;
    await page.getByPlaceholder("Nome").fill(productName);
    await page.getByPlaceholder("SKU (opcional)").fill(`SKU${stamp}`);
    await page.getByPlaceholder("Preco").fill("99,90");
    await page.getByPlaceholder("Custo").fill("40,00");
    await page.getByPlaceholder(/Quantidade atual/i).fill("3");
    await page.locator("form select").nth(0).selectOption(cat.data.id);
    await page.locator("form select").nth(1).selectOption(brand.data.id);
    await page.getByRole("button", { name: /Salvar produto/i }).click();
    await expect(page.getByText(productName).first()).toBeVisible({ timeout: 15_000 });
  });

  test("inicio dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Início", exact: true })).toBeVisible({
      timeout: 15_000
    });
  });

  test("billing plans Enterprise R$ 250", async ({ page }) => {
    await page.goto("/assinatura");
    await expect(page.getByRole("heading", { name: "Assinatura", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText(/250/)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("fluxos PRO (tenant isolado)", () => {
  test.setTimeout(120_000);

  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${API}/health`);
    expect(health.ok(), "API precisa estar no ar").toBeTruthy();
  });

  test("avisos de estoque: salvar e verificar", async ({ page, request }) => {
    const session = await registerFreshTenant(request);
    await forcePlanPro(session.tenantId);
    await ensureCatalog(request, session.token, { stock: 0, forceNew: true });
    await loginWithSession(page, {
      token: session.token,
      user: session.user,
      tenant: session.tenant
    });

    await page.goto("/estoque/alertas");
    await expect(page.getByRole("heading", { name: "Avisos de estoque", exact: true })).toBeVisible({
      timeout: 15_000
    });

    await page.getByLabel(/Avisos habilitados/i).check();
    await page.getByRole("button", { name: /Salvar/i }).click();
    await expect(page.getByText(/Configuracoes salvas|salvas/i).first()).toBeVisible({
      timeout: 15_000
    });

    await page.getByRole("button", { name: /Verificar agora/i }).click();
    await expect(
      page.getByText(/Disparo|desabilitados|Nada a disparar|aviso|enviado|logged/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("entrada NF-e: preview e confirmar estoque", async ({ page, request }) => {
    const session = await registerFreshTenant(request);
    await forcePlanPro(session.tenantId);
    await loginWithSession(page, {
      token: session.token,
      user: session.user,
      tenant: session.tenant
    });

    await page.goto("/estoque/importar-nfe");
    await expect(page.getByRole("heading", { name: /Entrada por NF-e/i })).toBeVisible({
      timeout: 15_000
    });

    await page.locator('input[type="file"]').setInputFiles(SAMPLE_NFE);
    await expect(page.getByText(/Arquivo:/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /Ler nota e continuar/i }).click();
    await expect(
      page
        .getByText(/Produto encontrado|Produto novo|Necessita vinculacao|Revis|Fornecedor|Conferencia/i)
        .first()
    ).toBeVisible({ timeout: 20_000 });

    const priceInputs = page.locator("label").filter({ hasText: /Preco venda/i }).locator("input");
    const count = await priceInputs.count();
    for (let i = 0; i < count; i += 1) {
      const el = priceInputs.nth(i);
      const val = await el.inputValue();
      if (!String(val || "").trim()) {
        await el.fill("49,90");
      }
    }

    await page.getByRole("button", { name: /Confirmar e atualizar estoque/i }).click();
    await expect(
      page.getByText(/NF-e importada|estoque atualizado|Importacao concluida|Concluida/i).first()
    ).toBeVisible({ timeout: 25_000 });
  });
});
