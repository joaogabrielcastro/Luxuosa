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

  it("rateia desconto, destina CPF e pagamento outros", () => {
    const payload = buildNotaasNfcePayload({
      sale: {
        id: "sale_2",
        paymentMethod: "BOLETO",
        discountValue: 5,
        totalValue: 35,
        customer: { name: "Maria Silva", cpfCnpj: "12345678901", email: "maria@loja.test" },
        items: [
          {
            quantity: 1,
            unitPrice: 40,
            productVariation: { product: { id: "p1", name: "Camisa", sku: "ABC" } }
          }
        ]
      }
    });
    assert.equal(payload.items[0].desconto, 5);
    assert.equal(payload.pagamentos[0].tipoPagamento, "99");
    assert.equal(payload.dest.cpf, "12345678901");
    assert.equal(payload.dest.email, "maria@loja.test");

    const cnpjDest = buildNotaasNfcePayload({
      sale: {
        id: "sale_3",
        paymentMethod: "CASH",
        items: [
          {
            quantity: 1,
            unitPrice: 10,
            productVariation: { product: { name: "Item", sku: "1" } }
          }
        ],
        customer: { name: "Loja X", cpfCnpj: "12345678000199" }
      }
    });
    assert.equal(cnpjDest.dest.cnpj, "12345678000199");
  });
});
