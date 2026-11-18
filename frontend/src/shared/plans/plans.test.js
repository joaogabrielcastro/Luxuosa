import { describe, expect, it } from "vitest";
import { resolveEntitlements } from "./plans.js";

describe("resolveEntitlements", () => {
  it("usa as permissões vindas do servidor", () => {
    const e = resolveEntitlements({
      plan: "BASIC",
      entitlements: { planGateExempt: false, maxUsers: 3, features: { nfeImport: false, stockAlerts: false }, featureMinPlan: { nfeImport: "PRO" } }
    });
    expect(e.has("nfeImport")).toBe(false);
    expect(e.minPlan("nfeImport")).toBe("PRO");
    expect(e.maxUsers).toBe(3);
  });

  it("não bloqueia lojas isentas", () => {
    const e = resolveEntitlements({
      plan: "BASIC",
      entitlements: { planGateExempt: true, maxUsers: null, features: { nfeImport: true, advancedReports: true } }
    });
    expect(e.exempt).toBe(true);
    expect(e.has("advancedReports")).toBe(true);
    expect(e.maxUsers).toBe(null);
  });

  it("sessão antiga sem entitlements não bloqueia nada na UI", () => {
    const e = resolveEntitlements({ plan: "BASIC" });
    expect(e.has("nfeImport")).toBe(true);
    expect(e.has("fiscalClosing")).toBe(true);
  });
});
