import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const sales = [];
const sessions = [];

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      sale: {
        findMany: async () => sales
      },
      cashSession: {
        findFirst: async ({ where }) =>
          sessions.find((s) => (!where.status || s.status === where.status) && (!where.id || s.id === where.id)) ||
          null,
        findMany: async () => sessions,
        count: async () => sessions.length,
        create: async ({ data }) => {
          const row = {
            id: "cs1",
            status: "OPEN",
            openedAt: new Date(),
            openingFloat: data.openingFloat,
            openedByUserId: data.openedByUserId,
            tenantId: data.tenantId,
            openedBy: { id: data.openedByUserId, name: "Admin", email: "a@loja.test" }
          };
          sessions.push(row);
          return row;
        },
        update: async ({ data }) => {
          const row = sessions[0];
          Object.assign(row, data, {
            closedBy: { id: data.closedByUserId, name: "Admin", email: "a@loja.test" }
          });
          return row;
        }
      }
    }
  }
});

const { cashService } = await import("./cash.service.js");

describe("cashService", () => {
  it("abre, preview, fecha e lista", async () => {
    sales.push({ paymentMethod: "CASH", totalValue: 30 }, { paymentMethod: "PIX", totalValue: 20 });
    const currentEmpty = await cashService.getCurrent("t1");
    assert.ok(currentEmpty.preview);
    const preview = await cashService.preview("t1");
    assert.equal(preview.saleCount, 2);

    const opened = await cashService.open("t1", "u1", { openingFloat: 50 });
    assert.equal(opened.status, "OPEN");
    await assert.rejects(() => cashService.open("t1", "u1", {}), /Ja existe/);

    await assert.rejects(() => cashService.close("t1", "u1", "missing", { countedCash: 0 }), /nao encontrada/);
    const closed = await cashService.close("t1", "u1", "cs1", { countedCash: 48, notes: "ok" });
    assert.equal(closed.status, "CLOSED");
    await assert.rejects(
      () => cashService.close("t1", "u1", "cs1", { countedCash: 0 }),
      /ja esta fechada/
    );
    const listed = await cashService.list("t1", { take: 10, skip: 0 });
    assert.equal(listed.total, 1);
  });
});
