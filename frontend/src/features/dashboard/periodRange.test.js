import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fillDailySeries, lastDayDelta, rangeForPreset } from "./periodRange.js";

describe("periodRange", () => {
  it("este mês vai do dia 1 até a data informada", () => {
    const range = rangeForPreset("month", new Date(2026, 8, 9));
    assert.equal(range.from, "2026-09-01");
    assert.equal(range.to, "2026-09-09");
  });

  it("hoje usa o mesmo dia em from e to", () => {
    const range = rangeForPreset("today", new Date(2026, 8, 9));
    assert.equal(range.from, "2026-09-09");
    assert.equal(range.to, "2026-09-09");
  });

  it("preenche dias sem venda com zero", () => {
    const series = fillDailySeries("2026-09-01", "2026-09-03", [{ date: "2026-09-02", amount: 50, count: 1 }]);
    assert.equal(series.length, 3);
    assert.equal(series[0].amount, 0);
    assert.equal(series[1].amount, 50);
    assert.equal(series[2].amount, 0);
  });

  it("não calcula percentual se o dia anterior for zero", () => {
    assert.equal(lastDayDelta([{ amount: 10 }, { amount: 0 }]), null);
  });

  it("calcula percentual entre dois dias com venda", () => {
    const delta = lastDayDelta([
      { amount: 100, count: 1 },
      { amount: 150, count: 1 }
    ]);
    assert.equal(delta.percent, 50);
  });
});
