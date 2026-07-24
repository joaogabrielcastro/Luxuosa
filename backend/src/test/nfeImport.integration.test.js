import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import {
  api,
  destroyTenant,
  prisma,
  registerTenant,
  seedCatalog,
  startTestServer
} from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";
const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePath = join(__dirname, "../shared/fixtures/sample-nfe.xml");

function uniqueAccessKey() {
  const stamp = String(Date.now());
  const rnd = String(Math.floor(Math.random() * 1e10)).padStart(10, "0");
  return `${stamp}${rnd}`.replace(/\D/g, "").slice(0, 44).padEnd(44, "0");
}

function mutateSampleXml(xml, { accessKey, cProd1, ean1, cProd2 } = {}) {
  const key = accessKey || uniqueAccessKey();
  const nNF = String(100000 + Math.floor(Math.random() * 800000));
  let out = xml
    .replace(/Id="NFe\d+"/g, `Id="NFe${key}"`)
    .replace(/<chNFe>\d+<\/chNFe>/g, `<chNFe>${key}</chNFe>`)
    .replace(/<nNF>\d+<\/nNF>/g, `<nNF>${nNF}</nNF>`);
  if (cProd1) {
    out = out.replace(/<cProd>ABC-001<\/cProd>/, `<cProd>${cProd1}</cProd>`);
  }
  if (ean1) {
    out = out
      .replace(/<cEAN>7891234567890<\/cEAN>/, `<cEAN>${ean1}</cEAN>`)
      .replace(/<cEANTrib>7891234567890<\/cEANTrib>/, `<cEANTrib>${ean1}</cEANTrib>`);
  }
  if (cProd2) {
    out = out.replace(/<cProd>XYZ-002<\/cProd>/, `<cProd>${cProd2}</cProd>`);
  }
  return out;
}

async function enablePro(tenantId) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: "PRO" }
  });
}

async function createTaxonomy(baseUrl, token) {
  const cat = await api(baseUrl, "/categories", {
    method: "POST",
    token,
    body: { name: `Cat NFe ${Date.now()}` }
  });
  assert.ok([200, 201].includes(cat.status), JSON.stringify(cat.data));
  const brand = await api(baseUrl, "/brands", {
    method: "POST",
    token,
    body: { name: `Marca NFe ${Date.now()}` }
  });
  assert.ok([200, 201].includes(brand.status), JSON.stringify(brand.data));
  return { categoryId: cat.data.id, brandId: brand.data.id };
}

describe("nfeImport integration", { skip: !runDb }, () => {
  /** @type {{ baseUrl: string, close: () => Promise<void> }} */
  let server;
  const tenantIds = [];

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    for (const id of tenantIds) {
      await destroyTenant(id);
    }
    await server.close();
  });

  it("preview confirm e list imports no plano PRO", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    await enablePro(session.tenantId);

    const { categoryId, brandId } = await createTaxonomy(server.baseUrl, session.token);
    const sample = readFileSync(samplePath, "utf8");
    const xmlContent = mutateSampleXml(sample);

    const preview = await api(server.baseUrl, "/nfe-imports/preview", {
      method: "POST",
      token: session.token,
      body: { xmlContent }
    });
    assert.equal(preview.status, 200);
    assert.ok(preview.data.invoice?.accessKey || preview.data.items);

    const items = (preview.data.items || []).map((item) => ({
      lineNumber: item.lineNumber,
      action: "create",
      name: item.description || `Item ${item.lineNumber}`,
      categoryId,
      brandId,
      price: Number(item.unitValue) || 10,
      sku: item.ean || item.supplierCode || null,
      quantityEntered: Math.max(1, Math.round(Number(item.quantity) || 1))
    }));
    assert.ok(items.length >= 1);

    const confirm = await api(server.baseUrl, "/nfe-imports/confirm", {
      method: "POST",
      token: session.token,
      body: {
        xmlContent,
        supplierDecision: {
          action: "create",
          name: "FORNECEDOR EXEMPLO LTDA",
          tradeName: "FORNECEDOR EX",
          stateRegistration: "123456789"
        },
        items
      }
    });
    assert.equal(confirm.status, 201, JSON.stringify(confirm.data));
    assert.ok(confirm.data.id);

    const list = await api(server.baseUrl, "/nfe-imports", { token: session.token });
    assert.equal(list.status, 200);
    const rows = list.data.items || list.data;
    assert.ok(Array.isArray(rows));
    assert.ok(rows.length >= 1);
  });

  it("create sem categoria/marca retorna 400", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    await enablePro(session.tenantId);

    const sample = readFileSync(samplePath, "utf8");
    const xmlContent = mutateSampleXml(sample);

    const preview = await api(server.baseUrl, "/nfe-imports/preview", {
      method: "POST",
      token: session.token,
      body: { xmlContent }
    });
    assert.equal(preview.status, 200);

    const items = (preview.data.items || []).map((item) => ({
      lineNumber: item.lineNumber,
      action: "create",
      name: item.description || `Item ${item.lineNumber}`,
      price: Number(item.unitValue) || 10,
      quantityEntered: Math.max(1, Math.round(Number(item.quantity) || 1))
    }));

    const confirm = await api(server.baseUrl, "/nfe-imports/confirm", {
      method: "POST",
      token: session.token,
      body: {
        xmlContent,
        supplierDecision: { action: "create", name: "FORNECEDOR EXEMPLO LTDA" },
        items
      }
    });
    assert.equal(confirm.status, 400);
  });

  it("preview faz match por EAN, cProd como SKU e codigo do fornecedor", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    await enablePro(session.tenantId);

    const { categoryId, brandId } = await createTaxonomy(server.baseUrl, session.token);

    const eanSku = `789${String(Date.now()).slice(-10)}`;
    const cProdSku = `CPROD-${Date.now()}`;
    const supplierCodeOnly = `SUP-${Date.now()}`;

    const productEan = await api(server.baseUrl, "/products", {
      method: "POST",
      token: session.token,
      body: {
        name: "Produto EAN",
        price: 40,
        cost: 15,
        categoryId,
        brandId,
        sku: eanSku,
        minStock: 0
      }
    });
    assert.ok([200, 201].includes(productEan.status), JSON.stringify(productEan.data));

    const productCprod = await api(server.baseUrl, "/products", {
      method: "POST",
      token: session.token,
      body: {
        name: "Produto cProd SKU",
        price: 30,
        cost: 12,
        categoryId,
        brandId,
        sku: cProdSku,
        minStock: 0
      }
    });
    assert.ok([200, 201].includes(productCprod.status), JSON.stringify(productCprod.data));

    const productLinked = await api(server.baseUrl, "/products", {
      method: "POST",
      token: session.token,
      body: {
        name: "Produto supplier code",
        price: 20,
        cost: 8,
        categoryId,
        brandId,
        sku: `OTHER-${Date.now()}`,
        minStock: 0
      }
    });
    assert.ok([200, 201].includes(productLinked.status), JSON.stringify(productLinked.data));

    const supplier = await api(server.baseUrl, "/suppliers", {
      method: "POST",
      token: session.token,
      body: {
        cnpj: "12345678000190",
        name: "FORNECEDOR EXEMPLO LTDA",
        tradeName: "FORNECEDOR EX"
      }
    });
    assert.ok([200, 201].includes(supplier.status), JSON.stringify(supplier.data));

    await prisma.productSupplierCode.create({
      data: {
        tenantId: session.tenantId,
        productId: productLinked.data.id,
        supplierId: supplier.data.id,
        code: supplierCodeOnly
      }
    });

    // Item 1: EAN match; Item 2: cProd as SKU (no EAN in sample item 2)
    let sample = readFileSync(samplePath, "utf8");
    let xmlContent = mutateSampleXml(sample, { ean1: eanSku, cProd2: cProdSku });

    let preview = await api(server.baseUrl, "/nfe-imports/preview", {
      method: "POST",
      token: session.token,
      body: { xmlContent }
    });
    assert.equal(preview.status, 200);
    const byLine = Object.fromEntries((preview.data.items || []).map((i) => [i.lineNumber, i]));
    assert.equal(byLine[1].matchBy, "EAN");
    assert.equal(byLine[1].matchedProduct.id, productEan.data.id);
    assert.equal(byLine[2].matchBy, "SKU");
    assert.equal(byLine[2].matchedProduct.id, productCprod.data.id);

    // Item 2 via ProductSupplierCode when SKU does not match cProd
    sample = readFileSync(samplePath, "utf8");
    xmlContent = mutateSampleXml(sample, {
      ean1: `999${String(Date.now()).slice(-10)}`,
      cProd2: supplierCodeOnly
    });
    preview = await api(server.baseUrl, "/nfe-imports/preview", {
      method: "POST",
      token: session.token,
      body: { xmlContent }
    });
    assert.equal(preview.status, 200);
    const item2 = (preview.data.items || []).find((i) => i.lineNumber === 2);
    assert.equal(item2.matchBy, "SUPPLIER_CODE");
    assert.equal(item2.matchedProduct.id, productLinked.data.id);
  });

  it("link atualiza preco sem alterar custo quando updateCost=false", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    await enablePro(session.tenantId);

    const catalog = await seedCatalog(server.baseUrl, session.token, {
      price: 50,
      cost: 20,
      stock: 5
    });

    const ean = `788${String(Date.now()).slice(-10)}`;
    await prisma.product.update({
      where: { id: catalog.productId },
      data: { sku: ean, price: 50, cost: 20 }
    });

    const sample = readFileSync(samplePath, "utf8");
    const xmlContent = mutateSampleXml(sample, { ean1: ean });

    const preview = await api(server.baseUrl, "/nfe-imports/preview", {
      method: "POST",
      token: session.token,
      body: { xmlContent }
    });
    assert.equal(preview.status, 200);
    const item1 = (preview.data.items || []).find((i) => i.lineNumber === 1);
    assert.equal(item1.matchBy, "EAN");

    const { categoryId, brandId } = await createTaxonomy(server.baseUrl, session.token);
    const items = (preview.data.items || []).map((item) => {
      if (item.lineNumber === 1) {
        return {
          lineNumber: 1,
          action: "link",
          productId: catalog.productId,
          quantityEntered: 2,
          updateCost: false,
          updatePrice: true,
          price: 99.9
        };
      }
      return {
        lineNumber: item.lineNumber,
        action: "create",
        name: item.description || `Item ${item.lineNumber}`,
        categoryId,
        brandId,
        price: Number(item.unitValue) || 10,
        sku: item.ean || item.supplierCode || `SKU-${item.lineNumber}-${Date.now()}`,
        quantityEntered: Math.max(1, Math.round(Number(item.quantity) || 1))
      };
    });

    const confirm = await api(server.baseUrl, "/nfe-imports/confirm", {
      method: "POST",
      token: session.token,
      body: {
        xmlContent,
        supplierDecision: { action: "create", name: "FORNECEDOR EXEMPLO LTDA" },
        items
      }
    });
    assert.equal(confirm.status, 201, JSON.stringify(confirm.data));

    const product = await prisma.product.findFirst({
      where: { tenantId: session.tenantId, id: catalog.productId }
    });
    assert.equal(Number(product.cost), 20);
    assert.equal(Number(product.price), 99.9);
  });
});
