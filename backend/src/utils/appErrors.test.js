import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ERROR_CODES,
  buildErrorResponse,
  createAppError,
  isOperationalError,
  mapPrismaError
} from "./appErrors.js";

describe("appErrors", () => {
  it("createAppError e operacional", () => {
    const err = createAppError("falhou", 409, ERROR_CODES.CONFLICT);
    assert.equal(err.statusCode, 409);
    assert.equal(isOperationalError(err), true);
    assert.equal(isOperationalError(new Error("boom")), false);
  });

  it("mapeia Prisma P2002/P2025/default", () => {
    assert.equal(mapPrismaError({ code: "P2002", meta: { target: ["sku"] } }).status, 409);
    assert.equal(mapPrismaError({ code: "P2002", meta: { target: ["tenantId"] } }).status, 409);
    assert.equal(mapPrismaError({ code: "P2003" }).status, 409);
    assert.equal(mapPrismaError({ code: "P2025" }).status, 404);
    assert.equal(mapPrismaError({ code: "P2014" }).status, 409);
    assert.equal(mapPrismaError({ code: "P2016" }).status, 400);
    assert.equal(mapPrismaError({ code: "P9999" }).status, 400);
  });

  it("buildErrorResponse", () => {
    assert.deepEqual(buildErrorResponse({ error: "x", code: "A", details: [{ message: "d" }] }), {
      error: "x",
      code: "A",
      details: [{ message: "d" }]
    });
    assert.deepEqual(buildErrorResponse({ error: "x" }), { error: "x" });
  });
});
