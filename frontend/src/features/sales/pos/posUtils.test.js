import { describe, expect, it } from "vitest";
import {
  buildGrid,
  buildSalePayload,
  computeChange,
  computeTotals,
  discountIssue,
  exactCodeMatches,
  groupByProduct,
  matchesAllWords,
  serverSearchTerm
} from "./posUtils.js";

const p1 = { id: "p1", name: "Vestido Midi", sku: "VM-01", price: 199.9, brand: { name: "Lux" } };
const vars = [
  { id: "a", productId: "p1", size: "M", color: "Preto", sku: "789001", stock: 2, product: p1 },
  { id: "b", productId: "p1", size: "P", color: "Preto", sku: "789002", stock: 0, product: p1 },
  { id: "c", productId: "p1", size: "P", color: "Azul", sku: "", stock: 4, product: p1 },
  { id: "d", productId: "p2", size: "", color: "", sku: null, stock: 5, product: { id: "p2", name: "Cinto", sku: "CI-1", price: 50 } }
];

describe("busca do PDV", () => {
  it("usa a palavra mais longa no servidor e refina por todas", () => {
    expect(serverSearchTerm("vestido p azul")).toBe("vestido");
    expect(serverSearchTerm("789001")).toBe("789001");
    expect(vars.filter((v) => matchesAllWords(v, "vestido p azul")).map((v) => v.id)).toEqual(["c"]);
  });

  it("agrupa por produto e identifica grade", () => {
    const groups = groupByProduct(vars);
    expect(groups).toHaveLength(2);
    expect(groups[0].totalStock).toBe(6);
    expect(groups[0].hasGrid).toBe(true);
    expect(groups[1].hasGrid).toBe(false);
  });

  it("encontra por etiqueta da variação antes do produto", () => {
    expect(exactCodeMatches(vars, "789002").map((v) => v.id)).toEqual(["b"]);
    expect(exactCodeMatches(vars, "VM-01").map((v) => v.id)).toEqual(["a", "b", "c"]);
    expect(exactCodeMatches(vars, "cinto").map((v) => v.id)).toEqual(["d"]);
  });

  it("monta a grade com tamanhos em ordem de moda", () => {
    const grid = buildGrid(vars.slice(0, 3));
    expect(grid.sizes).toEqual(["P", "M"]);
    expect(grid.colors).toEqual(["Azul", "Preto"]);
    expect(grid.get("M", "Preto").id).toBe("a");
    expect(grid.get("M", "Azul")).toBe(null);
  });
});

describe("totais e regras", () => {
  const lines = [
    { variation: vars[0], quantity: 2, unitPrice: "100,00" },
    { variation: vars[3], quantity: 1, unitPrice: "50,00" }
  ];

  it("calcula desconto em valor ou percentual como o backend", () => {
    expect(computeTotals(lines, { discountMode: "value", discountInput: "25,00" })).toMatchObject({
      gross: 250,
      discountValue: 25,
      discountPercent: 0,
      total: 225,
      itemCount: 3
    });
    expect(computeTotals(lines, { discountMode: "percent", discountInput: "10" })).toMatchObject({
      discountPercent: 10,
      discountValue: 0,
      total: 225
    });
  });

  it("aplica o limite de 10% para atendente", () => {
    const ok = computeTotals(lines, { discountMode: "percent", discountInput: "10" });
    const over = computeTotals(lines, { discountMode: "value", discountInput: "30,00" });
    expect(discountIssue(ok, "ATTENDANT")).toBe(null);
    expect(discountIssue(over, "ATTENDANT")).toMatch(/10%/);
    expect(discountIssue(over, "ADMIN")).toBe(null);
  });

  it("monta o mesmo contrato da API", () => {
    const totals = computeTotals(lines, { discountMode: "value", discountInput: "" });
    expect(
      buildSalePayload({ lines, totals, paymentMethod: "INSTALLMENT", installments: 1, customerId: "", emitNfce: true })
    ).toEqual({
      paymentMethod: "INSTALLMENT",
      installments: 2,
      discountValue: 0,
      discountPercent: 0,
      customerId: null,
      emitNfce: true,
      items: [
        { productVariationId: "a", quantity: 2, unitPrice: 100 },
        { productVariationId: "d", quantity: 1, unitPrice: 50 }
      ]
    });
    expect(
      "emitNfce" in buildSalePayload({ lines, totals, paymentMethod: "PIX", installments: 1, editing: true })
    ).toBe(false);
  });

  it("calcula troco", () => {
    expect(computeChange(87.5, "100,00")).toEqual({ received: 100, change: 12.5, missing: 0 });
    expect(computeChange(87.5, "50,00").missing).toBe(37.5);
  });
});
