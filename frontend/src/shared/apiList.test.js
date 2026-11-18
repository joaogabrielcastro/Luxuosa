import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { unwrapList } from "./apiList.js";

describe("unwrapList", () => {
  it("aceita array legado", () => {
    assert.deepEqual(unwrapList([{ id: 1 }]), [{ id: 1 }]);
  });

  it("extrai items paginados", () => {
    assert.deepEqual(unwrapList({ items: [{ id: 2 }], total: 1 }), [{ id: 2 }]);
  });

  it("sem items vira array vazio", () => {
    assert.deepEqual(unwrapList(null), []);
    assert.deepEqual(unwrapList({}), []);
  });
});

describe("fetchAllPages", () => {
  it("percorre as páginas até o total", async () => {
    const { fetchAllPages } = await import("./apiList.js");
    const all = Array.from({ length: 450 }, (_, i) => ({ id: i }));
    const calls = [];
    const res = await fetchAllPages(async ({ take, skip }) => {
      calls.push(skip);
      return { items: all.slice(skip, skip + take), total: all.length };
    });
    expect(res.items).toHaveLength(450);
    expect(calls).toEqual([0, 200, 400]);
  });
});
