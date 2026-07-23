import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";

export const API = process.env.E2E_API_URL || "http://localhost:3001/api/v1";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, "../../backend");
export const DEMO_AUTH_FILE = path.join(__dirname, ".auth-demo-admin.json");

/**
 * Garante storageState demo (1 login). Reutiliza arquivo se ja tiver token.
 * @param {import('@playwright/test').Browser} browser
 */
export async function ensureDemoAuthFile(browser) {
  fs.mkdirSync(path.dirname(DEMO_AUTH_FILE), { recursive: true });
  try {
    const raw = fs.readFileSync(DEMO_AUTH_FILE, "utf8");
    const state = JSON.parse(raw);
    const origin = state?.origins?.find((o) => String(o.origin || "").includes("localhost:3006"));
    const hasToken = origin?.localStorage?.some(
      (e) => e.name === "luxuosa_session" && String(e.value || "").includes('"token"')
    );
    if (hasToken) return DEMO_AUTH_FILE;
  } catch {
    /* regenera */
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAsDemoAdmin(page);
  await context.storageState({ path: DEMO_AUTH_FILE });
  await context.close();
  return DEMO_AUTH_FILE;
}

/**
 * Login demo admin. Prefers API + localStorage (1 request) e faz retry em 429.
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsDemoAdmin(page) {
  const existing = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("luxuosa_session");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  if (existing?.token) {
    await page.goto("/vendas");
    if (!/\/login/.test(page.url())) {
      await expect(page).toHaveURL(/\/vendas/, { timeout: 15_000 });
      return;
    }
  }

  let data = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await page.request.post(`${API}/auth/login`, {
      data: { email: "admin@luxuosa.com", password: "123456" }
    });
    if (res.status() === 429) {
      await page.waitForTimeout(8_000 * (attempt + 1));
      continue;
    }
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`login API ${res.status()}: ${body}`);
    }
    data = await res.json();
    break;
  }
  if (!data?.token) {
    throw new Error("loginAsDemoAdmin: rate limit ou falha apos retries");
  }

  await page.goto("/login");
  await page.evaluate((session) => {
    localStorage.setItem("luxuosa_session", JSON.stringify(session));
  }, data);
  await page.goto("/vendas");
  await expect(page).toHaveURL(/\/vendas/, { timeout: 20_000 });
}

/**
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} path
 * @param {{ method?: string, token?: string, body?: unknown }} [opts]
 */
export async function apiJson(request, path, { method = "GET", token, body } = {}) {
  const res = await request.fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    data: body !== undefined ? body : undefined
  });
  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { ok: res.ok(), status: res.status(), data: parsed };
}

export async function sessionToken(page) {
  const session = await page.evaluate(() => {
    const raw = localStorage.getItem("luxuosa_session");
    return raw ? JSON.parse(raw) : null;
  });
  if (!session?.token) {
    throw new Error("luxuosa_session.token ausente apos login");
  }
  return session.token;
}

function uniqueCnpj() {
  const stamp = String(Date.now()).slice(-10);
  const rnd = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
  return `${stamp}${rnd}`.slice(0, 14);
}

/**
 * POST /auth/register — loja isolada para testes.
 * @param {import('@playwright/test').APIRequestContext} request
 */
export async function registerFreshTenant(request) {
  const cnpj = uniqueCnpj();
  const stamp = Date.now();
  const body = {
    tenantName: `E2E Loja ${cnpj.slice(-4)}`,
    cnpj,
    tenantEmail: `e2e.loja.${stamp}@luxuosa.test`,
    adminName: "Admin E2E",
    adminEmail: `e2e.admin.${stamp}@luxuosa.test`,
    adminPassword: "senha123"
  };
  const res = await apiJson(request, "/auth/register", { method: "POST", body });
  if (res.status !== 201) {
    throw new Error(`registerFreshTenant falhou (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return {
    token: res.data.token,
    tenantId: res.data.tenant.id,
    userId: res.data.user.id,
    adminEmail: body.adminEmail,
    adminPassword: body.adminPassword,
    cnpj,
    ...res.data
  };
}

/**
 * Forca plano via Prisma (script backend). Requer DATABASE_URL acessivel no host (:5434 no Docker).
 * @param {string} tenantIdOrEmail
 * @param {"BASIC"|"PRO"|"ENTERPRISE"} [plan]
 */
export async function forcePlanPro(tenantIdOrEmail, plan = "PRO") {
  const script = path.join(BACKEND_ROOT, "scripts/e2e-set-plan.mjs");
  // Nao herdar DATABASE_URL do Docker (host `db`) — Playwright roda no host (:5434).
  const databaseUrl =
    process.env.E2E_DATABASE_URL ||
    process.env.TEST_DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5434/luxuosa";
  const out = execFileSync(process.execPath, [script, tenantIdOrEmail, plan], {
    cwd: BACKEND_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    }
  });
  const line = out.trim().split("\n").pop();
  return JSON.parse(line);
}

/**
 * Login com sessao ja obtida (ex.: registerFreshTenant).
 * @param {import('@playwright/test').Page} page
 * @param {{ token: string, user: object, tenant: object }} session
 */
export async function loginWithSession(page, session) {
  await page.goto("/login");
  await page.evaluate((s) => {
    localStorage.setItem("luxuosa_session", JSON.stringify(s));
  }, session);
  await page.goto("/vendas");
  await expect(page).toHaveURL(/\/vendas/, { timeout: 20_000 });
}

/**
 * Garante categoria + marca + produto + variacao com estoque via API.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} token
 * @param {{ stock?: number, price?: number, cost?: number, forceNew?: boolean }} [opts]
 */
export async function ensureCatalog(
  request,
  token,
  { stock = 20, price = 49.9, cost = 20, forceNew = false } = {}
) {
  if (!forceNew) {
    const products = await apiJson(request, "/products?take=50&skip=0", { token });
    if (!products.ok) {
      throw new Error(`list products: ${JSON.stringify(products.data)}`);
    }
    const items = products.data?.items || [];
    if (items.length > 0) {
      const variations = await apiJson(request, "/product-variations?take=50&skip=0", { token });
      const list = variations.data?.items || [];
      const withStock = list.find((v) => Number(v.stock) >= 1) || list[0];
      if (withStock?.id) {
        if (Number(withStock.stock) < 1) {
          await apiJson(request, "/stock-movements", {
            method: "POST",
            token,
            body: {
              productVariationId: withStock.id,
              type: "ENTRY",
              quantity: stock
            }
          });
        }
        return {
          productId: withStock.productId || withStock.product?.id,
          variationId: withStock.id,
          sku: withStock.product?.sku || items[0].sku,
          stock: Math.max(Number(withStock.stock) || 0, stock),
          price: Number(withStock.product?.price ?? items[0].price ?? price),
          reused: true
        };
      }
    }
  }

  const stamp = Date.now();
  const cat = await apiJson(request, "/categories", {
    method: "POST",
    token,
    body: { name: `E2E Cat ${stamp}` }
  });
  if (!cat.ok) throw new Error(`categoria: ${JSON.stringify(cat.data)}`);

  const brand = await apiJson(request, "/brands", {
    method: "POST",
    token,
    body: { name: `E2E Marca ${stamp}` }
  });
  if (!brand.ok) throw new Error(`marca: ${JSON.stringify(brand.data)}`);

  const sku = `E2E${stamp}`;
  const product = await apiJson(request, "/products", {
    method: "POST",
    token,
    body: {
      name: `E2E Produto ${stamp}`,
      price,
      cost,
      categoryId: cat.data.id,
      brandId: brand.data.id,
      minStock: 2,
      sku
    }
  });
  if (!product.ok) throw new Error(`produto: ${JSON.stringify(product.data)}`);

  const variation = await apiJson(request, "/product-variations", {
    method: "POST",
    token,
    body: {
      productId: product.data.id,
      size: "M",
      color: "Azul",
      stock
    }
  });
  if (!variation.ok) throw new Error(`variacao: ${JSON.stringify(variation.data)}`);

  return {
    categoryId: cat.data.id,
    brandId: brand.data.id,
    productId: product.data.id,
    variationId: variation.data.id,
    sku,
    stock,
    price,
    reused: false
  };
}
