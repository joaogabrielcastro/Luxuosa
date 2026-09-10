import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const categories = new Map([["cat1", { id: "cat1", tenantId: "t1" }]]);
const brands = new Map([["br1", { id: "br1", tenantId: "t1" }]]);
const products = new Map();

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      category: {
        findFirst: async ({ where }) => categories.get(where.id) || null
      },
      brand: {
        findFirst: async ({ where }) => brands.get(where.id) || null
      },
      async $transaction(fn) {
        const tx = {
          product: {
            findFirst: async ({ where }) => products.get(where.id) || null,
            deleteMany: async ({ where }) => {
              if (!products.has(where.id)) return { count: 0 };
              products.delete(where.id);
              return { count: 1 };
            }
          },
          saleItem: { count: async () => 0 },
          creditSaleItem: { count: async () => 0 },
          stockMovement: { deleteMany: async () => ({ count: 0 }) },
          productVariation: { deleteMany: async () => ({ count: 1 }) }
        };
        return fn(tx);
      }
    }
  }
});

mock.module("./product.repository.js", {
  namedExports: {
    productRepository: {
      list: async () => [...products.values()],
      listPaged: async () => ({ items: [...products.values()], total: products.size, take: 50, skip: 0 }),
      findById: async (tenantId, id) => products.get(id) || null,
      create: async (tenantId, payload) => {
        const row = { id: "p1", tenantId, ...payload, variations: [] };
        products.set(row.id, row);
        return row;
      },
      update: async (tenantId, id) => (products.has(id) ? { count: 1 } : { count: 0 }),
      findLowStock: async () => [
        {
          id: "p1",
          name: "Camisa",
          sku: "CAM",
          minStock: 2,
          category: { name: "Vestidos" },
          brand: { name: "Lux" },
          variations: [{ stock: 0 }]
        }
      ]
    }
  }
});

const { productService } = await import("./product.service.js");

describe("productService", () => {
  it("rejeita categoria/marca e cria", async () => {
    await assert.rejects(() => productService.create("t1", { categoryId: "x", brandId: "br1" }), /Categoria/);
    await assert.rejects(() => productService.create("t1", { categoryId: "cat1", brandId: "x" }), /Marca/);
    const created = await productService.create("t1", { categoryId: "cat1", brandId: "br1", name: "Camisa" });
    assert.equal(created.id, "p1");
    assert.equal((await productService.list("t1"))[0].id, "p1");
    assert.equal((await productService.getById("t1", "p1")).id, "p1");
    const paged = await productService.listPaged("t1", {});
    assert.equal(paged.total, 1);
  });

  it("update 404 e lowStock", async () => {
    await assert.rejects(() => productService.update("t1", "missing", { name: "X" }), /nao encontrado/);
    await assert.rejects(() => productService.update("t1", "p1", { categoryId: "x" }), /Categoria/);
    await assert.rejects(() => productService.update("t1", "p1", { brandId: "x" }), /Marca/);
    const low = await productService.lowStock("t1");
    assert.equal(low[0].severity, "critical");
  });

  it("remove produto com variacoes sem venda", async () => {
    products.set("p2", { id: "p2", tenantId: "t1", variations: [{ id: "v1" }] });
    const deleted = await productService.remove("t1", "p2");
    assert.equal(deleted.count, 1);
    await assert.rejects(() => productService.remove("t1", "missing"), /nao encontrado/);
  });
});
