import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNotaasNfcePayload } from "./notaasNfceBuilder.js";

describe("buildNotaasNfcePayload", () => {
  it("monta NFC-e modelo 65 com item e PIX", () => {
    const payload = buildNotaasNfcePayload({
      sale: {
        id: "sale_1",
        paymentMethod: "PIX",
        discountValue: 0,
        totalValue: 40,
        items: [
          {
            quantity: 2,
            unitPrice: 20,
            productVariation: {
              product: {
                id: "p1",
                name: "Camiseta",
                sku: "7891234567890",
                ncm: "61091000",
                cfop: "5102",
                icmsCsosn: "102"
              }
            }
          }
        ]
      }
    });

    assert.equal(payload.modelo, 65);
    assert.equal(payload.referencia, "sale_1");
    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0].quantidade, 2);
    assert.equal(payload.items[0].valorTotal, 40);
    assert.equal(payload.items[0].ean, "7891234567890");
    assert.equal(payload.pagamentos[0].tipoPagamento, "17");
    assert.equal(payload.pagamentos[0].valor, 40);
  });

  it("rejeita venda sem itens", () => {
    assert.throws(
      () => buildNotaasNfcePayload({ sale: { id: "x", items: [] } }),
      (err) => err.statusCode === 400
    );
  });
});
