import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { api, destroyTenant, prisma, registerTenant, startTestServer } from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("fiscal closing integration", { skip: !runDb }, () => {
  /** @type {{ baseUrl: string, close: () => Promise<void> }} */
  let server;
  const tenantIds = [];

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    for (const id of tenantIds) {
      await destroyTenant(id);
    }
    await server.close();
  });

  it("BASIC recebe 402; PRO resume e exporta zip do mes", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    const blocked = await api(server.baseUrl, "/fiscal-closing/summary?year=2026&month=9", {
      token: session.token
    });
    assert.equal(blocked.status, 402);

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: { plan: "PRO" }
    });

    const badMonth = await api(server.baseUrl, "/fiscal-closing/summary?year=2026&month=13", {
      token: session.token
    });
    assert.equal(badMonth.status, 400);

    const summary = await api(server.baseUrl, "/fiscal-closing/summary?year=2026&month=9", {
      token: session.token
    });
    assert.equal(summary.status, 200);
    assert.equal(summary.data.period.month, 9);
    assert.equal(summary.data.nfce.issued.count, 0);
    assert.ok(Array.isArray(summary.data.details?.nfceIssued));

    const zip = await api(server.baseUrl, "/fiscal-closing/export?year=2026&month=9", {
      token: session.token
    });
    assert.equal(zip.status, 200);
    const ctype = zip.headers.get("content-type") || "";
    assert.ok(ctype.includes("zip"));
    const filename = zip.headers.get("content-disposition") || "";
    assert.ok(filename.includes("fechamento-fiscal_"));
  });
});
