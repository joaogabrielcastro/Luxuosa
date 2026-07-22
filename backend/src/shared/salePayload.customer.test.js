import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertCustomerBelongsToTenant } from "./salePayload.js";

describe("assertCustomerBelongsToTenant", () => {
  it("noop quando customerId ausente", async () => {
    await assert.doesNotReject(() =>
      assertCustomerBelongsToTenant({ customer: { findFirst: async () => null } }, "t1", null)
    );
    await assert.doesNotReject(() =>
      assertCustomerBelongsToTenant({ customer: { findFirst: async () => null } }, "t1", undefined)
    );
  });

  it("aceita cliente do tenant", async () => {
    const tx = {
      customer: {
        findFirst: async ({ where }) => {
          assert.equal(where.tenantId, "t1");
          assert.equal(where.id, "c1");
          return { id: "c1" };
        }
      }
    };
    await assert.doesNotReject(() => assertCustomerBelongsToTenant(tx, "t1", "c1"));
  });

  it("rejeita cliente de outra loja", async () => {
    const tx = {
      customer: {
        findFirst: async () => null
      }
    };
    await assert.rejects(
      () => assertCustomerBelongsToTenant(tx, "t1", "missing"),
      (err) => err.statusCode === 400
    );
  });
});
