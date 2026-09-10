import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { formatZodError, formatZodErrorDetails, isZodError } from "./zodError.js";

describe("zodError", () => {
  it("nao e ZodError", () => {
    assert.equal(formatZodError(new Error("x")), null);
    assert.deepEqual(formatZodErrorDetails(new Error("x")), []);
    assert.equal(isZodError({ name: "ZodError" }), true);
  });

  it("traduz issues comuns", () => {
    const schema = z.object({
      email: z.string().email(),
      quantity: z.number().min(1),
      name: z.string().min(2),
      items: z.array(z.object({ unitPrice: z.number().positive() })).min(1),
      type: z.enum(["A", "B"])
    });
    const parsed = schema.safeParse({
      email: "x",
      quantity: 0,
      name: "",
      items: [],
      type: "C"
    });
    assert.equal(parsed.success, false);
    const msg = formatZodError(parsed.error);
    assert.ok(msg.includes("e-mail") || msg.includes("E-mail"));
    const details = formatZodErrorDetails(parsed.error);
    assert.ok(details.length >= 1);
  });

  it("um unico campo", () => {
    const parsed = z.object({ name: z.string().min(1) }).safeParse({ name: "" });
    const msg = formatZodError(parsed.error);
    assert.ok(msg.toLowerCase().includes("nome") || msg.toLowerCase().includes("preencha"));
  });
});
