import assert from "node:assert/strict";
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

describe("catalog integration", { skip: !runDb }, () => {
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

  it("categories brands products variations CRUD + low-stock", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const { token } = session;

    const cat = await api(server.baseUrl, "/categories", {
      method: "POST",
      token,
      body: { name: `Cat CRUD ${Date.now()}` }
    });
    assert.equal(cat.status, 201);
    const categoryId = cat.data.id;

    const catGet = await api(server.baseUrl, `/categories/${categoryId}`, { token });
    assert.equal(catGet.status, 200);
    assert.equal(catGet.data.id, categoryId);

    const catUp = await api(server.baseUrl, `/categories/${categoryId}`, {
      method: "PUT",
      token,
      body: { name: `Cat Up ${Date.now()}` }
    });
    assert.equal(catUp.status, 204);

    const brand = await api(server.baseUrl, "/brands", {
      method: "POST",
      token,
      body: { name: `Brand CRUD ${Date.now()}` }
    });
    assert.equal(brand.status, 201);
    const brandId = brand.data.id;

    const brandUp = await api(server.baseUrl, `/brands/${brandId}`, {
      method: "PUT",
      token,
      body: { name: `Brand Up ${Date.now()}` }
    });
    assert.equal(brandUp.status, 204);

    const product = await api(server.baseUrl, "/products", {
      method: "POST",
      token,
      body: {
        name: `Prod CRUD ${Date.now()}`,
        price: 99,
        cost: 40,
        categoryId,
        brandId,
        minStock: 5,
        sku: `SKU${Date.now()}`
      }
    });
    assert.equal(product.status, 201);
    const productId = product.data.id;

    const prodUp = await api(server.baseUrl, `/products/${productId}`, {
      method: "PUT",
      token,
      body: { name: `Prod Up ${Date.now()}`, minStock: 8 }
    });
    assert.equal(prodUp.status, 204);

    const variation = await api(server.baseUrl, "/product-variations", {
      method: "POST",
      token,
      body: { productId, size: "G", color: "Preto", stock: 2 }
    });
    assert.equal(variation.status, 201);
    const variationId = variation.data.id;

    const varUp = await api(server.baseUrl, `/product-variations/${variationId}`, {
      method: "PUT",
      token,
      body: { stock: 1 }
    });
    assert.equal(varUp.status, 204);

    const low = await api(server.baseUrl, "/products/low-stock", { token });
    assert.equal(low.status, 200);
    assert.ok(Array.isArray(low.data) || Array.isArray(low.data?.items) || low.data);
    const lowItems = Array.isArray(low.data) ? low.data : low.data.items || [];
    assert.ok(lowItems.some((p) => p.id === productId || p.productId === productId));

    const listed = await api(server.baseUrl, `/products?categoryId=${categoryId}&brandId=${brandId}`, { token });
    assert.equal(listed.status, 200);
    assert.ok((listed.data.items || []).some((p) => p.id === productId));

    const listedQ = await api(server.baseUrl, `/products?q=Prod`, { token });
    assert.equal(listedQ.status, 200);

    const byId = await api(server.baseUrl, `/products/${productId}`, { token });
    assert.equal(byId.status, 200);
    assert.equal(byId.data.id, productId);

    const missing = await api(server.baseUrl, "/products/clxxxxxxxxxxxxxxxxxxxx", { token });
    assert.equal(missing.status, 404);

    const badCat = await api(server.baseUrl, "/products", {
      method: "POST",
      token,
      body: {
        name: `Prod Bad ${Date.now()}`,
        price: 10,
        cost: 1,
        categoryId: "clxxxxxxxxxxxxxxxxxxxx",
        brandId,
        minStock: 1
      }
    });
    assert.equal(badCat.status, 400);

    const vars = await api(
      server.baseUrl,
      `/product-variations?q=${encodeURIComponent(product.data.name)}&productId=${productId}&categoryId=${categoryId}&brandId=${brandId}`,
      { token }
    );
    assert.equal(vars.status, 200);

    const keepVar = await api(server.baseUrl, "/product-variations", {
      method: "POST",
      token,
      body: { productId, size: "P", color: "Azul", stock: 1 }
    });
    assert.equal(keepVar.status, 201);

    const prodDel = await api(server.baseUrl, `/products/${productId}`, {
      method: "DELETE",
      token
    });
    assert.equal(prodDel.status, 204);

    const brandDel = await api(server.baseUrl, `/brands/${brandId}`, {
      method: "DELETE",
      token
    });
    assert.equal(brandDel.status, 204);

    const catDel = await api(server.baseUrl, `/categories/${categoryId}`, {
      method: "DELETE",
      token
    });
    assert.equal(catDel.status, 204);
  });

  it("seedCatalog helper cria variacao com estoque", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 7 });
    const listed = await api(server.baseUrl, `/product-variations/${catalog.variationId}`, {
      token: session.token
    });
    assert.equal(listed.status, 200);
    assert.equal(listed.data.stock, 7);
  });

  it("404s, variacao inconsistente e exclusao", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 3 });

    const missingBrand = await api(server.baseUrl, "/brands/clxxxxxxxxxxxxxxxxxxxx", {
      token: session.token
    });
    assert.equal(missingBrand.status, 404);
    const missingCat = await api(server.baseUrl, "/categories/clxxxxxxxxxxxxxxxxxxxx", {
      token: session.token
    });
    assert.equal(missingCat.status, 404);
    const brandGet = await api(server.baseUrl, `/brands/${catalog.brandId}`, { token: session.token });
    assert.equal(brandGet.status, 200);

    const badVar = await api(server.baseUrl, "/product-variations", {
      method: "POST",
      token: session.token,
      body: { productId: catalog.productId, size: "G", color: "", stock: 1 }
    });
    assert.equal(badVar.status, 400);

    const defVar = await api(server.baseUrl, "/product-variations", {
      method: "POST",
      token: session.token,
      body: { productId: catalog.productId, size: "", color: "", stock: 1 }
    });
    assert.ok([200, 201, 400, 409].includes(defVar.status));

    const missingVar = await api(server.baseUrl, "/product-variations/clxxxxxxxxxxxxxxxxxxxx", {
      token: session.token
    });
    assert.equal(missingVar.status, 404);

    const extra = await api(server.baseUrl, "/product-variations", {
      method: "POST",
      token: session.token,
      body: { productId: catalog.productId, size: "GG", color: "Vermelho", stock: 1 }
    });
    assert.equal(extra.status, 201);
    const del = await api(server.baseUrl, `/product-variations/${extra.data.id}`, {
      method: "DELETE",
      token: session.token
    });
    assert.equal(del.status, 204);

    await api(server.baseUrl, `/brands/cxxxxxxxxxxxxxxxxxxxxxxx`, {
      method: "PUT",
      token: session.token,
      body: { name: "X" }
    }).then((res) => assert.ok([400, 404].includes(res.status)));
    await api(server.baseUrl, `/categories/cxxxxxxxxxxxxxxxxxxxxxxx`, {
      method: "DELETE",
      token: session.token
    }).then((res) => assert.ok([400, 404].includes(res.status)));
  });
});
