import { describe, expect, it } from "vitest";
import { nfceState } from "./nfceActions.js";

describe("nfceState", () => {
  it("resume o status da nota", () => {
    expect(nfceState({ invoice: { status: "ISSUED" } }).key).toBe("ISSUED");
    expect(nfceState({ invoice: { status: "ERROR" } }).key).toBe("ERROR");
    expect(nfceState({ invoice: null, nfceJob: { status: "FAILED" } }).key).toBe("ERROR");
    expect(nfceState({ invoice: null, nfceJob: { status: "PROCESSING" } }).key).toBe("PROCESSING");
    expect(nfceState({ invoice: { status: "PENDING" } }).key).toBe("PENDING");
    expect(nfceState({}).key).toBe("NONE");
  });
});
