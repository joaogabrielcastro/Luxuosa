import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRetriableErr, isRetriableLastError } from "./nfceRetry.js";

describe("isRetriableErr", () => {
  it("aceita 5xx, timeout e ETIMEDOUT", () => {
    assert.equal(isRetriableErr({ statusCode: 502 }), true);
    assert.equal(isRetriableErr({ statusCode: 504 }), true);
    assert.equal(isRetriableErr({ code: "ETIMEDOUT" }), true);
    assert.equal(isRetriableErr({ message: "connection timeout" }), true);
  });

  it("recusa 4xx de negocio", () => {
    assert.equal(isRetriableErr({ statusCode: 400 }), false);
    assert.equal(isRetriableErr({ statusCode: 409 }), false);
    assert.equal(isRetriableErr({ message: "CNPJ invalido" }), false);
  });
});

describe("isRetriableLastError", () => {
  it("vazio ou indisponibilidade sao retentaveis", () => {
    assert.equal(isRetriableLastError(""), true);
    assert.equal(isRetriableLastError("503 temporariamente indisponivel"), true);
    assert.equal(isRetriableLastError("rate limit"), true);
  });

  it("erro de payload nao retenta", () => {
    assert.equal(isRetriableLastError("CNPJ do emitente divergente"), false);
  });
});
