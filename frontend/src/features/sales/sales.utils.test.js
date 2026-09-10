import { describe, expect, it } from "vitest";
import {
  brandIdsForCategory,
  emptyLineItem,
  filterVariationsBySearch,
  findVariationsByExactCodeOrName,
  nfceJobStatusLabel,
  normalizeSaleSearch,
  paymentLabel,
  saleStatusLabel,
  variationsForCategoryAndBrand
} from "./sales.utils.js";

const vars = [
  {
    id: "v1",
    size: "M",
    color: "Preto",
    stock: 3,
    product: { name: "Camisa Polo", sku: "CAM-01", categoryId: "c1", brandId: "b1" }
  },
  {
    id: "v2",
    size: "G",
    color: "Branco",
    stock: 0,
    product: { name: "Camisa Polo", sku: "CAM-01", categoryId: "c1", brandId: "b1" }
  },
  {
    id: "v3",
    size: "P",
    color: "Azul",
    stock: 2,
    product: { name: "Calça", sku: "CAL-02", categoryId: "c2", brandId: "b2" }
  }
];

describe("sales.utils", () => {
  it("normaliza busca sem acento", () => {
    expect(normalizeSaleSearch("  Camisão  ")).toBe("camisao");
  });

  it("filtra por palavras e estoque restante", () => {
    expect(filterVariationsBySearch(vars, "").length).toBe(0);
    expect(filterVariationsBySearch(vars, "camisa preto").map((v) => v.id)).toEqual(["v1"]);
    expect(filterVariationsBySearch(vars, "CAM-01").length).toBe(2);
    expect(
      filterVariationsBySearch(vars, "camisa", { getRemainingUnits: (id) => (id === "v1" ? 1 : 0) }).map((v) => v.id)
    ).toEqual(["v1"]);
  });

  it("encontra SKU ou nome exato", () => {
    expect(findVariationsByExactCodeOrName(vars, "").length).toBe(0);
    expect(findVariationsByExactCodeOrName(vars, "CAM-01").length).toBe(2);
    expect(findVariationsByExactCodeOrName(vars, "calça").map((v) => v.id)).toEqual(["v3"]);
  });

  it("filtra categoria/marca e coleta brands", () => {
    expect(variationsForCategoryAndBrand(vars, "", "b1")).toEqual([]);
    expect(variationsForCategoryAndBrand(vars, "c1", "b1").map((v) => v.id)).toEqual(["v1", "v2"]);
    expect([...brandIdsForCategory(vars, "c1")]).toEqual(["b1"]);
  });

  it("labels e linha vazia", () => {
    expect(emptyLineItem().productVariationId).toBe("");
    expect(paymentLabel("PIX")).toBe("PIX");
    expect(paymentLabel("OUTRO")).toBe("OUTRO");
    expect(saleStatusLabel("PAID")).toBe("Paga");
    expect(saleStatusLabel("X")).toBe("X");
    expect(nfceJobStatusLabel("PENDING")).toBe("Na fila");
    expect(nfceJobStatusLabel("")).toBe("");
  });
});
