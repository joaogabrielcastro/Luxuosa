import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { logger } from "./logger.js";

describe("logger", () => {
  it("info warn error nao explodem", () => {
    logger.info("i", { a: 1 });
    logger.warn("w");
    logger.error("e", { error: "x" });
    assert.ok(true);
  });
});
