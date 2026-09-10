import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  clearMockNotaasEmissions,
  getMockNotaasEmissions,
  getNfeDanfe,
  getNfeStatus,
  getNfeXml,
  pingNotaasApiKey,
  postNfeEmitir
} from "./notaasApi.js";
import { env } from "../../config/env.js";

describe("notaasApi mock", () => {
  afterEach(() => {
    clearMockNotaasEmissions();
  });

  it("emite, status, danfe, xml e ping", async () => {
    const prev = env.nfceMock;
    env.nfceMock = true;
    const emit = await postNfeEmitir("ntaas_test", { referencia: "sale-1", modelo: 65 });
    assert.equal(emit.ok, true);
    assert.ok(emit.body.invoiceId);
    assert.equal(getMockNotaasEmissions().length, 1);

    const st = await getNfeStatus("ntaas_test", emit.body.invoiceId);
    assert.equal(st.body.status, "issued");

    const pdf = await getNfeDanfe("k", emit.body.invoiceId);
    assert.equal(pdf.isBinary, true);

    const xml = await getNfeXml("k", emit.body.invoiceId);
    assert.match(String(xml.body), /nfeProc/);

    const ping = await pingNotaasApiKey("k");
    assert.equal(ping.ok, true);
    env.nfceMock = prev;
  });
});

describe("notaasFetch real", () => {
  it("parseia json, xml, pdf e 401 no ping", async () => {
    const prev = env.nfceMock;
    env.nfceMock = false;
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (String(url).includes("/xml")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/xml" },
          text: async () => "<xml/>",
          arrayBuffer: async () => new ArrayBuffer(0)
        };
      }
      if (String(url).includes("/danfe")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/pdf" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
          text: async () => ""
        };
      }
      if (String(url).includes("ping_luxuosa_probe")) {
        return {
          ok: false,
          status: 401,
          headers: { get: () => "application/json" },
          text: async () => JSON.stringify({ error: "no" })
        };
      }
      if (String(url).includes("/status")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          text: async () => "not-json"
        };
      }
      return {
        ok: true,
        status: 202,
        headers: { get: () => "application/json" },
        text: async () => JSON.stringify({ queued: true })
      };
    };

    const emit = await postNfeEmitir("k", { referencia: "x" });
    assert.equal(emit.body.queued, true);
    const st = await getNfeStatus("k", "id1");
    assert.ok(st.body.raw);
    const xml = await getNfeXml("k", "id1");
    assert.equal(xml.isXml, true);
    const pdf = await getNfeDanfe("k", "id1");
    assert.equal(pdf.isBinary, true);
    const ping = await pingNotaasApiKey("k");
    assert.equal(ping.ok, false);

    globalThis.fetch = orig;
    env.nfceMock = prev;
  });
});
