import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePageQuery, pagedResult } from "./pagination.js";

describe("parsePageQuery", () => {
  it("usa defaults quando query vazia", () => {
    const { take, skip } = parsePageQuery({});
    assert.equal(take, 50);
    assert.equal(skip, 0);
  });

  it("respeita take e skip validos", () => {
    const { take, skip } = parsePageQuery({ take: "25", skip: "10" });
    assert.equal(take, 25);
    assert.equal(skip, 10);
  });

  it("limita take ao maxTake", () => {
    const { take } = parsePageQuery({ take: "9999" }, { maxTake: 100 });
    assert.equal(take, 100);
  });

  it("normaliza take invalido para default", () => {
    const { take } = parsePageQuery({ take: "0" }, { defaultTake: 20 });
    assert.equal(take, 20);
  });
});

describe("pagedResult", () => {
  it("monta envelope paginado", () => {
    const out = pagedResult([{ id: 1 }], { total: 1, take: 50, skip: 0 });
    assert.deepEqual(out, { items: [{ id: 1 }], total: 1, take: 50, skip: 0 });
  });
});
