import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFiscalMonth, safeFileName } from "./fiscalClosingMonth.js";

describe("parseFiscalMonth", () => {
  it("resolve agosto/2026", () => {
    const p = parseFiscalMonth(2026, 8);
    assert.equal(p.label, "Agosto/2026");
    assert.equal(p.from, "2026-08-01");
    assert.equal(p.to, "2026-08-31");
    assert.equal(p.start.getMonth(), 7);
    assert.equal(p.end.getDate(), 31);
  });

  it("rejeita mes invalido", () => {
    assert.throws(() => parseFiscalMonth(2026, 13), (err) => err.statusCode === 400);
  });
});

describe("safeFileName", () => {
  it("remove caracteres perigosos", () => {
    assert.equal(safeFileName("Loja/Luxuosa*"), "Loja_Luxuosa_");
  });
});
