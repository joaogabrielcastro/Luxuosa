import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { CreditSaleStatus } from "@prisma/client";

const customers = new Map([["c1", { id: "c1", tenantId: "t1", name: "Maria", cpfCnpj: "12345678901" }]]);
const variations = new Map([
  ["v1", { id: "v1", tenantId: "t1", stock: 10, product: { id: "p1", name: "Camisa", price: 80 } }]
]);
const creditSales = [];
const payments = [];

function toNum(v) {
  return Number(v);
}

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      creditSale: {
        findMany: async ({ where }) =>
          creditSales.filter((s) => {
            if (where.status && s.status !== where.status) return false;
            return true;
          }),
        count: async () => creditSales.length,
        findFirst: async ({ where }) => creditSales.find((s) => s.id === where.id) || null
      },
      async $transaction(fn) {
        const tx = {
          customer: {
            findFirst: async ({ where }) => customers.get(where.id) || null,
            updateMany: async () => ({ count: 1 })
          },
          productVariation: {
            findMany: async ({ where }) =>
              (where.id?.in || []).map((id) => variations.get(id)).filter(Boolean),
            updateMany: async ({ where, data }) => {
              const v = variations.get(where.id);
              if (!v) return { count: 0 };
              if (data.stock?.decrement) {
                if (v.stock < data.stock.decrement) return { count: 0 };
                v.stock -= data.stock.decrement;
              }
              if (data.stock?.increment) v.stock += data.stock.increment;
              return { count: 1 };
            }
          },
          stockMovement: { create: async () => ({ id: "m1" }) },
          creditSale: {
            create: async ({ data }) => {
              const row = {
                id: `cs-${creditSales.length + 1}`,
                tenantId: data.tenantId,
                customerId: data.customerId,
                userId: data.userId,
                totalValue: data.totalValue,
                discountValue: data.discountValue,
                discountPercent: data.discountPercent,
                paidTotal: 0,
                status: CreditSaleStatus.OPEN,
                notes: data.notes,
                items: (data.items?.create || []).map((it, i) => ({ id: `i${i}`, ...it })),
                customer: customers.get(data.customerId)
              };
              creditSales.push(row);
              return row;
            },
            findFirst: async ({ where }) => {
              const row = creditSales.find((s) => s.id === where.id);
              if (!row) return null;
              return { ...row, items: row.items || [] };
            },
            update: async ({ where, data }) => {
              const row = creditSales.find((s) => s.id === where.id);
              Object.assign(row, data);
              return { ...row, customer: customers.get(row.customerId), payments };
            },
            delete: async ({ where }) => {
              const idx = creditSales.findIndex((s) => s.id === where.id);
              creditSales.splice(idx, 1);
              return { count: 1 };
            }
          },
          creditPayment: {
            create: async ({ data }) => {
              payments.push(data);
              return data;
            }
          }
        };
        return fn(tx);
      }
    }
  }
});

const { crediarioService } = await import("./crediario.service.js");

describe("crediarioService", () => {
  it("lista, cria, paga, cancela e exclui", async () => {
    const listed = await crediarioService.list("t1", { status: "OPEN", q: "Maria 123" });
    assert.equal(listed.total, 0);
    await crediarioService.list("t1", { q: "abc" });
    assert.equal(await crediarioService.getById("t1", "missing"), null);

    await assert.rejects(
      () => crediarioService.create("t1", "u1", "ADMIN", { customerId: "x", items: [] }),
      /Cliente/
    );
    await assert.rejects(
      () =>
        crediarioService.create("t1", "u1", "ADMIN", {
          customerId: "c1",
          items: [
            { productVariationId: "v1", quantity: 1, unitPrice: 80 },
            { productVariationId: "v1", quantity: 1, unitPrice: 80 }
          ]
        }),
      /repetir a mesma variacao/
    );
    await assert.rejects(
      () =>
        crediarioService.create("t1", "u1", "ADMIN", {
          customerId: "c1",
          items: [{ productVariationId: "missing", quantity: 1, unitPrice: 80 }]
        }),
      /variacoes/
    );
    await assert.rejects(
      () =>
        crediarioService.create("t1", "u1", "ATTENDANT", {
          customerId: "c1",
          discountPercent: 15,
          items: [{ productVariationId: "v1", quantity: 1, unitPrice: 80 }]
        }),
      /10%/
    );
    await assert.rejects(
      () =>
        crediarioService.create("t1", "u1", "ADMIN", {
          customerId: "c1",
          discountValue: -1,
          items: [{ productVariationId: "v1", quantity: 1, unitPrice: 80 }]
        }),
      /negativos/
    );
    await assert.rejects(
      () =>
        crediarioService.create("t1", "u1", "ADMIN", {
          customerId: "c1",
          discountPercent: 101,
          items: [{ productVariationId: "v1", quantity: 1, unitPrice: 80 }]
        }),
      /100/
    );

    const created = await crediarioService.create("t1", "u1", "ADMIN", {
      customerId: "c1",
      notes: "  prazo  ",
      discountValue: 0,
      discountPercent: 10,
      items: [{ productVariationId: "v1", quantity: 2, unitPrice: 80 }]
    });
    assert.equal(created.status, CreditSaleStatus.OPEN);

    const byId = await crediarioService.getById("t1", created.id);
    assert.ok(byId.remaining > 0);

    await assert.rejects(() => crediarioService.addPayment("t1", "x", { amount: 10 }), /nao encontrada/);
    await assert.rejects(
      () => crediarioService.addPayment("t1", created.id, { amount: 0 }),
      /maior que zero/
    );
    await assert.rejects(
      () => crediarioService.addPayment("t1", created.id, { amount: 999 }),
      /excede/
    );
    await assert.rejects(
      () => crediarioService.addPayment("t1", created.id, { amount: 10, paidAt: "nope" }),
      /Data/
    );

    const paidPart = await crediarioService.addPayment("t1", created.id, {
      amount: 20,
      paymentMethod: "pix",
      note: "parcela"
    });
    assert.equal(paidPart.status, CreditSaleStatus.OPEN);

    await assert.rejects(() => crediarioService.cancel("t1", created.id), /apos recebimento/);
    await assert.rejects(() => crediarioService.remove("t1", created.id), /recebimento em aberto/);

    const settled = await crediarioService.addPayment("t1", created.id, {
      amount: toNum(created.totalValue) - 20,
      paymentMethod: "dinheiro"
    });
    assert.equal(settled.status, CreditSaleStatus.PAID);
    await assert.rejects(
      () => crediarioService.addPayment("t1", created.id, { amount: 1 }),
      /em aberto/
    );
    await assert.rejects(() => crediarioService.cancel("t1", created.id), /em aberto/);

    const removed = await crediarioService.remove("t1", created.id);
    assert.equal(removed.ok, true);

    const open2 = await crediarioService.create("t1", "u1", "ADMIN", {
      customerId: "c1",
      items: [{ productVariationId: "v1", quantity: 1, unitPrice: 80 }]
    });
    const canceled = await crediarioService.cancel("t1", open2.id);
    assert.equal(canceled.status, CreditSaleStatus.CANCELED);
    const again = await crediarioService.cancel("t1", open2.id);
    assert.equal(again.status, CreditSaleStatus.CANCELED);
    await assert.rejects(() => crediarioService.cancel("t1", "missing"), /nao encontrada/);
    await assert.rejects(() => crediarioService.remove("t1", "missing"), /nao encontrada/);
    await crediarioService.remove("t1", open2.id);
  });
});
