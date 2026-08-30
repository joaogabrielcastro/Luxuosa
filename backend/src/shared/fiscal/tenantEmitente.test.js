import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertEmpresaCnpjMatchesTenant,
  assertNfcePayloadEmitente,
  buildTenantFiscalContext,
  requireTenantEmitenteCnpj,
  resolveEmitenteCnpj
} from "./tenantEmitente.js";

describe("resolveEmitenteCnpj multi-tenant", () => {
  it("usa apenas CNPJ do tenant quando valido", () => {
    const r = resolveEmitenteCnpj("11.111.111/0001-91");
    assert.equal(r.emitCnpj, "11111111000191");
    assert.equal(r.source, "tenant");
  });

  it("rejeita CNPJ invalido", () => {
    const r = resolveEmitenteCnpj("123");
    assert.equal(r.source, "invalid");
    assert.equal(r.emitCnpj, "");
  });
});

describe("requireTenantEmitenteCnpj", () => {
  it("retorna 14 digitos do tenant", () => {
    assert.equal(requireTenantEmitenteCnpj("11111111000191"), "11111111000191");
  });

  it("rejeita CNPJ invalido", () => {
    assert.throws(
      () => requireTenantEmitenteCnpj("invalid"),
      (err) => err.code === "NFCE_TENANT_CNPJ_REQUIRED"
    );
  });
});

describe("assertEmpresaCnpjMatchesTenant / payload", () => {
  it("aceita empresa com mesmo CNPJ", () => {
    assert.doesNotThrow(() =>
      assertEmpresaCnpjMatchesTenant({ cpf_cnpj: "11.111.111/0001-91" }, "11111111000191")
    );
  });

  it("bloqueia empresa de outro CNPJ", () => {
    assert.throws(
      () => assertEmpresaCnpjMatchesTenant({ cpf_cnpj: "12440489000100" }, "11111111000191"),
      (err) => err.code === "NFCE_EMITENTE_MISMATCH"
    );
  });

  it("bloqueia payload com emitente errado", () => {
    assert.throws(
      () =>
        assertNfcePayloadEmitente(
          { infNFe: { emit: { CNPJ: "12440489000100" } } },
          "11111111000191"
        ),
      (err) => err.code === "NFCE_PAYLOAD_EMITENTE_MISMATCH"
    );
  });
});

describe("buildTenantFiscalContext", () => {
  it("willEmitNfce so com CNPJ do tenant e flag ligada", () => {
    const ok = buildTenantFiscalContext({
      cnpj: "11111111000191",
      enableNfceEmission: true
    });
    assert.equal(ok.willEmitNfce, true);

    const bad = buildTenantFiscalContext({
      cnpj: "123",
      enableNfceEmission: true
    });
    assert.equal(bad.willEmitNfce, false);
  });
});
