import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDefaultVariation, isDefaultVariationInput } from "./autoVariation.js";

describe("isDefaultVariation", () => {
  it("identifica size/color vazios", () => {
    assert.equal(isDefaultVariation({ size: "", color: "" }), true);
    assert.equal(isDefaultVariation({ size: "  ", color: "" }), true);
    assert.equal(isDefaultVariation({ size: "M", color: "Preto" }), false);
    assert.equal(isDefaultVariation(null), false);
  });
});

describe("isDefaultVariationInput", () => {
  it("trata omitidos como padrao", () => {
    assert.equal(isDefaultVariationInput({}), true);
    assert.equal(isDefaultVariationInput({ size: "P", color: "" }), false);
  });
});
