import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-luxuosa-unit";
process.env.NFCE_MOCK = "true";

describe("nuvemFiscalApi mock", () => {
  /** @type {typeof import("../shared/nuvemFiscal/nuvemFiscalApi.js")} */
  let api;

  before(async () => {
    api = await import("./nuvemFiscalApi.js");
  });

  it("getEmpresa retorna mock", async () => {
    const res = await api.getEmpresa({}, "12345678000199");
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.equal(res.body.razao_social, "Mock");
    assert.equal(res.body.cpf_cnpj, "12345678000199");
    assert.ok(res.body.endereco);
  });

  it("getEmpresaNfceConfig retorna homologacao", async () => {
    const res = await api.getEmpresaNfceConfig({}, "12345678000199");
    assert.equal(res.ok, true);
    assert.equal(res.body.ambiente, "homologacao");
    assert.equal(res.body.serie, 1);
  });

  it("postNfce e getNfceById retornam autorizado", async () => {
    const posted = await api.postNfce({}, { dummy: true });
    assert.equal(posted.ok, true);
    assert.ok(String(posted.body.id).startsWith("mock_"));
    assert.equal(posted.body.status, "autorizado");
    assert.equal(String(posted.body.chave).length, 44);
    assert.equal(posted.body.autorizacao.codigo_status, 100);

    const got = await api.getNfceById({}, posted.body.id);
    assert.equal(got.ok, true);
    assert.equal(got.body.id, posted.body.id);
    assert.equal(got.body.autorizacao.codigo_status, 100);
  });
});
