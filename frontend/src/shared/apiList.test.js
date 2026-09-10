import assert from "node:assert/strict";
import { describe, it } from "vitest";
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
