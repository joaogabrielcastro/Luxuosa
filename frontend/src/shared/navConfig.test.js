import { describe, expect, it } from "vitest";
import { isNavItemActive, salesModuleItems, fiscalModuleItems } from "./navConfig.js";

describe("isNavItemActive", () => {
  it("distingue PDV e notas no mesmo pathname", () => {
    const pdv = { to: "/vendas" };
    const notas = { to: "/vendas?aba=notas" };
    expect(isNavItemActive(pdv, { pathname: "/vendas", search: "" })).toBe(true);
    expect(isNavItemActive(pdv, { pathname: "/vendas", search: "?aba=notas" })).toBe(false);
    expect(isNavItemActive(notas, { pathname: "/vendas", search: "?aba=notas" })).toBe(true);
    expect(isNavItemActive(notas, { pathname: "/vendas", search: "" })).toBe(false);
    expect(isNavItemActive({ to: "/estoque" }, { pathname: "/estoque", search: "" })).toBe(null);
  });

  it("monta abas de vendas e fiscal", () => {
    expect(salesModuleItems().map((i) => i.to)).toEqual(["/vendas", "/vendas?aba=notas"]);
    expect(fiscalModuleItems(true).some((i) => i.to === "/fechamento-fiscal")).toBe(true);
  });
});
