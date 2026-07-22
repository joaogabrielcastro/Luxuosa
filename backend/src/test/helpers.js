import { createServer } from "node:http";
import { prisma } from "../config/prisma.js";
import { app } from "../app.js";

/**
 * Sobe a app Express numa porta efemera e devolve baseUrl + close.
 */
export async function startTestServer() {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  return {
    baseUrl,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  };
}

export async function api(baseUrl, path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data, headers: res.headers };
}

let cnpjSeq = 0;

/** CNPJ unico de 14 digitos (somente para testes; nao precisa ser valido na Receita). */
export function uniqueTestCnpj() {
  cnpjSeq += 1;
  const stamp = String(Date.now()).slice(-10);
  const seq = String(cnpjSeq).padStart(4, "0");
  return `${stamp}${seq}`.slice(0, 14);
}

export function uniqueEmail(prefix = "test") {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@luxuosa.test`;
}

/**
 * Registra loja via API e devolve sessao + ids para cleanup.
 */
export async function registerTenant(baseUrl, overrides = {}) {
  const cnpj = overrides.cnpj || uniqueTestCnpj();
  const adminEmail = overrides.adminEmail || uniqueEmail("admin");
  const body = {
    tenantName: overrides.tenantName || `Loja Teste ${cnpj.slice(-4)}`,
    cnpj,
    tenantEmail: overrides.tenantEmail || uniqueEmail("loja"),
    adminName: overrides.adminName || "Admin Teste",
    adminEmail,
    adminPassword: overrides.adminPassword || "senha123",
    ...overrides
  };
  const res = await api(baseUrl, "/auth/register", { method: "POST", body });
  if (res.status !== 201) {
    const err = new Error(`register falhou (${res.status}): ${JSON.stringify(res.data)}`);
    err.response = res;
    throw err;
  }
  return {
    ...res.data,
    cnpj,
    adminEmail,
    adminPassword: body.adminPassword,
    tenantId: res.data.tenant.id,
    userId: res.data.user.id,
    token: res.data.token
  };
}

/**
 * Catalogo minimo: categoria, marca, produto, variacao com estoque.
 */
export async function seedCatalog(baseUrl, token, { stock = 10, price = 50, cost = 20 } = {}) {
  const cat = await api(baseUrl, "/categories", {
    method: "POST",
    token,
    body: { name: `Cat ${Date.now()}` }
  });
  if (cat.status !== 201 && cat.status !== 200) {
    throw new Error(`categoria: ${JSON.stringify(cat.data)}`);
  }
  const brand = await api(baseUrl, "/brands", {
    method: "POST",
    token,
    body: { name: `Marca ${Date.now()}` }
  });
  if (brand.status !== 201 && brand.status !== 200) {
    throw new Error(`marca: ${JSON.stringify(brand.data)}`);
  }
  const categoryId = cat.data.id;
  const brandId = brand.data.id;

  const product = await api(baseUrl, "/products", {
    method: "POST",
    token,
    body: {
      name: `Produto ${Date.now()}`,
      price,
      cost,
      categoryId,
      brandId,
      minStock: 2,
      sku: `SKU${Date.now()}`
    }
  });
  if (product.status !== 201 && product.status !== 200) {
    throw new Error(`produto: ${JSON.stringify(product.data)}`);
  }

  const variation = await api(baseUrl, "/product-variations", {
    method: "POST",
    token,
    body: {
      productId: product.data.id,
      size: "M",
      color: "Azul",
      stock
    }
  });
  if (variation.status !== 201 && variation.status !== 200) {
    throw new Error(`variacao: ${JSON.stringify(variation.data)}`);
  }

  return {
    categoryId,
    brandId,
    productId: product.data.id,
    variationId: variation.data.id,
    stock,
    price
  };
}

/** Remove tenant de teste e dados associados (melhor esforco). */
export async function destroyTenant(tenantId) {
  if (!tenantId) return;
  const tables = [
    () => prisma.nfeImportItem.deleteMany({ where: { tenantId } }),
    () => prisma.nfeImport.deleteMany({ where: { tenantId } }),
    () => prisma.productSupplierCode.deleteMany({ where: { tenantId } }),
    () => prisma.supplier.deleteMany({ where: { tenantId } }),
    () => prisma.creditPayment.deleteMany({ where: { tenantId } }),
    () => prisma.creditSaleItem.deleteMany({ where: { tenantId } }),
    () => prisma.creditSale.deleteMany({ where: { tenantId } }),
    () => prisma.nfceIssueJob.deleteMany({ where: { tenantId } }),
    () => prisma.invoice.deleteMany({ where: { tenantId } }),
    () => prisma.saleItem.deleteMany({ where: { tenantId } }),
    () => prisma.sale.deleteMany({ where: { tenantId } }),
    () => prisma.cashSession.deleteMany({ where: { tenantId } }),
    () => prisma.stockAlertLog.deleteMany({ where: { tenantId } }),
    () => prisma.stockMovement.deleteMany({ where: { tenantId } }),
    () => prisma.productVariation.deleteMany({ where: { tenantId } }),
    () => prisma.product.deleteMany({ where: { tenantId } }),
    () => prisma.brand.deleteMany({ where: { tenantId } }),
    () => prisma.category.deleteMany({ where: { tenantId } }),
    () => prisma.customer.deleteMany({ where: { tenantId } }),
    () => prisma.user.deleteMany({ where: { tenantId } }),
    () => prisma.tenant.deleteMany({ where: { id: tenantId } })
  ];
  for (const step of tables) {
    try {
      await step();
    } catch {
      /* ignore ordem FK */
    }
  }
}

export { prisma };
