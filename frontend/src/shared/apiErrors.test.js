import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { getErrorPresentation, parseApiErrorPayload } from "./apiErrors.js";

describe("parseApiErrorPayload", () => {
  it("usa error da API", () => {
    const parsed = parseApiErrorPayload({ error: "Cliente nao encontrado." }, 404);
    assert.equal(parsed.message, "Cliente nao encontrado.");
    assert.equal(parsed.status, 404);
  });

  it("esconde erro tecnico do Prisma", () => {
    const parsed = parseApiErrorPayload({ error: "Invalid `prisma.sale.findMany()` invocation" }, 500);
    assert.equal(parsed.message, "Erro no servidor. Tente novamente em instantes.");
  });

  it("usa dica do code", () => {
    const parsed = parseApiErrorPayload({ code: "PLAN_UPGRADE_REQUIRED" }, 402);
    assert.match(parsed.message, /plano/i);
  });

  it("junta detalhes de validacao", () => {
    const parsed = parseApiErrorPayload(
      {
        error: "Dados invalidos",
        code: "VALIDATION_ERROR",
        details: [
          { field: "name", message: "Nome curto" },
          { field: "email", message: "E-mail invalido" }
        ]
      },
      400
    );
    assert.match(parsed.message, /Nome curto/);
    assert.equal(parsed.details.length, 2);
  });

  it("401 troca mensagem pelo code", () => {
    const parsed = parseApiErrorPayload({ error: "jwt expired", code: "TOKEN_EXPIRED" }, 401);
    assert.match(parsed.message, /expirou/i);
  });
});

describe("getErrorPresentation", () => {
  it("titulo de sessao em 401", () => {
    const view = getErrorPresentation({ status: 401, message: "Sessao expirada" });
    assert.equal(view.title, "Sessao encerrada");
  });
});
