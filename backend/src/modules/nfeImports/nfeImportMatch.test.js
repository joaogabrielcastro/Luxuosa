import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchProductForItem } from "./nfeImportMatch.js";

function createFakeTx({ productsBySku = {}, supplierCodes = {} } = {}) {
  return {
    product: {
      async findFirst({ where }) {
        const sku = where?.sku;
        if (!sku) return null;
        return productsBySku[sku] || null;
      }
    },
    productSupplierCode: {
      async findFirst({ where }) {
        const key = `${where.supplierId}::${where.code}`;
        return supplierCodes[key] || null;
      }
    }
  };
}

describe("matchProductForItem", () => {
  const tenantId = "tenant-1";
  const productEan = { id: "p-ean", sku: "7891234567890" };
  const productCprod = { id: "p-cprod", sku: "ABC-001" };
  const productLinked = { id: "p-link", sku: "OTHER" };

  it("prioriza EAN = Product.sku", async () => {
    const tx = createFakeTx({
      productsBySku: {
        "7891234567890": productEan,
        "ABC-001": productCprod
      }
    });
    const result = await matchProductForItem(
      tx,
      tenantId,
      { ean: "7891234567890", supplierCode: "ABC-001" },
      { id: "sup-1" }
    );
    assert.equal(result.matchBy, "EAN");
    assert.equal(result.product.id, "p-ean");
  });

  it("usa cProd = Product.sku quando EAN nao encontra", async () => {
    const tx = createFakeTx({
      productsBySku: {
        "ABC-001": productCprod
      }
    });
    const result = await matchProductForItem(
      tx,
      tenantId,
      { ean: "0000000000000", supplierCode: "ABC-001" },
      { id: "sup-1" }
    );
    assert.equal(result.matchBy, "SKU");
    assert.equal(result.product.id, "p-cprod");
  });

  it("usa ProductSupplierCode quando SKU nao bate", async () => {
    const tx = createFakeTx({
      productsBySku: {},
      supplierCodes: {
        "sup-1::FORN-99": { product: productLinked }
      }
    });
    const result = await matchProductForItem(
      tx,
      tenantId,
      { ean: null, supplierCode: "FORN-99" },
      { id: "sup-1" }
    );
    assert.equal(result.matchBy, "SUPPLIER_CODE");
    assert.equal(result.product.id, "p-link");
  });

  it("retorna null quando nao ha match", async () => {
    const tx = createFakeTx();
    const result = await matchProductForItem(
      tx,
      tenantId,
      { ean: null, supplierCode: "X" },
      null
    );
    assert.equal(result.product, null);
    assert.equal(result.matchBy, null);
  });
});
