import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import {
  api,
  destroyTenant,
  prisma,
  registerTenant,
  startTestServer
} from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";
const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePath = join(__dirname, "../shared/fixtures/sample-nfe.xml");

function uniqueAccessKey() {
  const stamp = String(Date.now());
  const rnd = String(Math.floor(Math.random() * 1e10)).padStart(10, "0");
  return `${stamp}${rnd}`.replace(/\D/g, "").slice(0, 44).padEnd(44, "0");
}

function mutateSampleXml(xml) {
  const accessKey = uniqueAccessKey();
  const nNF = String(100000 + Math.floor(Math.random() * 800000));
  return xml
    .replace(/Id="NFe\d+"/g, `Id="NFe${accessKey}"`)
    .replace(/<chNFe>\d+<\/chNFe>/g, `<chNFe>${accessKey}</chNFe>`)
    .replace(/<nNF>\d+<\/nNF>/g, `<nNF>${nNF}</nNF>`);
}

describe("nfeImport integration", { skip: !runDb }, () => {
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

  it("preview confirm e list imports no plano PRO", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: { plan: "PRO" }
    });

    const sample = readFileSync(samplePath, "utf8");
    const xmlContent = mutateSampleXml(sample);

    const preview = await api(server.baseUrl, "/nfe-imports/preview", {
      method: "POST",
      token: session.token,
      body: { xmlContent }
    });
    assert.equal(preview.status, 200);
    assert.ok(preview.data.accessKey || preview.data.items);

    const items = (preview.data.items || []).map((item) => ({
      lineNumber: item.lineNumber,
      action: "create",
      name: item.description || `Item ${item.lineNumber}`,
      useDefaultTaxonomy: true,
      price: Number(item.unitValue) || 10,
      quantityEntered: Math.max(1, Math.round(Number(item.quantity) || 1)),
      updateCost: true
    }));
    assert.ok(items.length >= 1);

    const confirm = await api(server.baseUrl, "/nfe-imports/confirm", {
      method: "POST",
      token: session.token,
      body: {
        xmlContent,
        supplierDecision: {
          action: "create",
          name: "FORNECEDOR EXEMPLO LTDA",
          tradeName: "FORNECEDOR EX",
          stateRegistration: "123456789"
        },
        items
      }
    });
    assert.equal(confirm.status, 201);
    assert.ok(confirm.data.id || confirm.data.import?.id || confirm.data.nfeImport?.id);

    const list = await api(server.baseUrl, "/nfe-imports", { token: session.token });
    assert.equal(list.status, 200);
    const rows = list.data.items || list.data;
    assert.ok(Array.isArray(rows));
    assert.ok(rows.length >= 1);
  });
});
