import { describe, expect, it } from "vitest";
import { isDefaultVariation } from "./catalogConstants.js";

describe("isDefaultVariation", () => {
  it("reconhece estoque geral", () => {
    expect(isDefaultVariation(null)).toBe(false);
    expect(isDefaultVariation({ size: "", color: "" })).toBe(true);
    expect(isDefaultVariation({ size: "M", color: "Preto" })).toBe(false);
  });
});
