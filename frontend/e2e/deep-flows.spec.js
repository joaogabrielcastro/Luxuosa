import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
  API,
  apiJson,
  DEMO_AUTH_FILE,
  ensureCatalog,
  ensureDemoAuthFile,
  forcePlanPro,
  sessionToken
} from "./helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_NFE = path.resolve(__dirname, "../../backend/src/shared/fixtures/sample-nfe.xml");
const AUTH_FILE = DEMO_AUTH_FILE;

function uniqueAccessKey() {
  const stamp = String(Date.now());
  const rnd = String(Math.floor(Math.random() * 1e10)).padStart(10, "0");
  return `${stamp}${rnd}`.replace(/\D/g, "").slice(0, 44).padEnd(44, "0");
}

/** Gera XML temporario com chave unica (evita conflito @@unique tenant+accessKey). */
function writeUniqueSampleNfe() {
  const sample = fs.readFileSync(SAMPLE_NFE, "utf8");
  const accessKey = uniqueAccessKey();
  const nNF = String(100000 + Math.floor(Math.random() * 800000));
  const xml = sample
    .replace(/Id="NFe\d+"/g, `Id="NFe${accessKey}"`)
    .replace(/<chNFe>\d+<\/chNFe>/g, `<chNFe>${accessKey}</chNFe>`)
    .replace(/<nNF>\d+<\/nNF>/g, `<nNF>${nNF}</nNF>`);
  const out = path.join(__dirname, `.tmp-nfe-${accessKey.slice(-8)}.xml`);
  fs.writeFileSync(out, xml, "utf8");
  return out;
}

// Placeholder para o Playwright carregar storageState antes do beforeAll gravar a sessao real.
if (!fs.existsSync(AUTH_FILE)) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
}

test.describe("fluxos profundos", () => {
  test.setTimeout(90_000);

  test.beforeAll(async ({ browser, request }) => {
    const health = await request.get(`${API}/health`);
    expect(health.ok(), "API precisa estar no ar (docker compose / backend)").toBeTruthy();
    await ensureDemoAuthFile(browser);
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
      page.getByRole("heading", { name: "Movimentações", exact: true })
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
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: /Salvar produto/i }) });
    await form.getByPlaceholder("Nome", { exact: true }).fill(productName);
    await form.getByPlaceholder("SKU (opcional)").fill(`SKU${stamp}`);
    await form.getByPlaceholder("Preco").fill("99,90");
    await form.getByPlaceholder("Custo").fill("40,00");
    await form.getByPlaceholder(/Quantidade atual/i).fill("3");
    await form.locator("select").nth(0).selectOption(cat.data.id);
    await form.locator("select").nth(1).selectOption(brand.data.id);
    await form.getByRole("button", { name: /Salvar produto/i }).click();
    await expect(page.getByText(productName).first()).toBeVisible({ timeout: 15_000 });
  });

  test("inicio dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Início", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText("Ações rápidas").first()).toBeVisible();
    await expect(page.getByText("Faturamento do mês")).toBeVisible();
  });

  test("billing plans Enterprise R$ 250", async ({ page }) => {
    await page.goto("/assinatura");
    await expect(page.getByRole("heading", { name: "Assinatura", exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText(/250/)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("fluxos PRO (demo + forcePlanPro)", () => {
  test.setTimeout(120_000);

  test.beforeAll(async ({ browser, request }) => {
    const health = await request.get(`${API}/health`);
    expect(health.ok(), "API precisa estar no ar").toBeTruthy();
    await ensureDemoAuthFile(browser);
  });

  test.use({ storageState: AUTH_FILE });

  test("avisos de estoque: salvar e verificar", async ({ page, request }) => {
    await page.goto("/vendas");
    const token = await sessionToken(page);
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem("luxuosa_session")));
    await forcePlanPro(session.tenant.id);
    await ensureCatalog(request, token, { stock: 0, forceNew: true });

    await page.goto("/estoque/alertas");
    await expect(page.getByRole("heading", { name: "Alertas de estoque", exact: true })).toBeVisible({
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

  test("entrada NF-e: preview e confirmar estoque", async ({ page }) => {
    await page.goto("/vendas");
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem("luxuosa_session")));
    await forcePlanPro(session.tenant.id);

    const tmpXml = writeUniqueSampleNfe();
    try {
      await page.goto("/estoque/importar-nfe");
      await expect(page.getByRole("heading", { name: /Entrada por NF-e/i })).toBeVisible({
        timeout: 15_000
      });

      await page.locator('input[type="file"]').setInputFiles(tmpXml);
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
    } finally {
      try {
        fs.unlinkSync(tmpXml);
      } catch {
        /* ignore */
      }
      try {
        await forcePlanPro(session.tenant.id, "BASIC");
      } catch {
        /* ignore */
      }
    }
  });
});
