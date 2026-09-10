import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InvoiceStatus, NfceIssueJobStatus } from "@prisma/client";
import { assertSaleMutable } from "./saleGuards.js";

describe("assertSaleMutable", () => {
  it("404 se venda nao existe", async () => {
    const tx = {
      sale: { findFirst: async () => null },
      nfceIssueJob: { findUnique: async () => null }
    };
    await assert.rejects(() => assertSaleMutable(tx, "t", "s1"), /nao encontrada/);
  });

  it("409 se NFC-e autorizada", async () => {
    const tx = {
      sale: { findFirst: async () => ({ id: "s1", invoice: { status: InvoiceStatus.ISSUED }, items: [] }) },
      nfceIssueJob: { findUnique: async () => null }
    };
    await assert.rejects(() => assertSaleMutable(tx, "t", "s1"), /autorizada/);
  });

  it("409 se job PROCESSING", async () => {
    const tx = {
      sale: { findFirst: async () => ({ id: "s1", invoice: null, items: [] }) },
      nfceIssueJob: { findUnique: async () => ({ status: NfceIssueJobStatus.PROCESSING }) }
    };
    await assert.rejects(() => assertSaleMutable(tx, "t", "s1"), /andamento/);
  });

  it("retorna venda mutavel", async () => {
    const sale = { id: "s1", invoice: { status: InvoiceStatus.PENDING }, items: [] };
    const tx = {
      sale: { findFirst: async () => sale },
      nfceIssueJob: { findUnique: async () => ({ status: NfceIssueJobStatus.FAILED }) }
    };
    assert.equal(await assertSaleMutable(tx, "t", "s1"), sale);
  });
});
