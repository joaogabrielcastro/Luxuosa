import { describe, expect, it } from "vitest";
import { buildNav, bottomNavItems, fiscalModuleItems, isNavItemActive, salesModuleItems, stockModuleItems } from "./navConfig.js";

describe("isNavItemActive", () => {
  it("compara a aba quando o item usa query string", () => {
    const notas = { to: "/crediario?aba=contas" };
    expect(isNavItemActive(notas, { pathname: "/crediario", search: "?aba=contas" })).toBe(true);
    expect(isNavItemActive(notas, { pathname: "/crediario", search: "" })).toBe(false);
    expect(isNavItemActive({ to: "/estoque" }, { pathname: "/estoque", search: "" })).toBe(null);
  });
});

describe("menus", () => {
  it("monta abas de vendas e fiscal", () => {
    expect(salesModuleItems().map((i) => i.to)).toEqual(["/vendas", "/vendas/historico"]);
    expect(fiscalModuleItems(true).some((i) => i.to === "/fechamento-fiscal")).toBe(true);
    expect(fiscalModuleItems(false).some((i) => i.to === "/fechamento-fiscal")).toBe(false);
  });

  it("esconde itens administrativos do atendente", () => {
    const admin = buildNav("ADMIN").groups.flatMap((g) => g.items).map((i) => i.to);
    const attendant = buildNav("ATTENDANT").groups.flatMap((g) => g.items).map((i) => i.to);
    expect(admin).toContain("/estoque/importar-nfe");
    expect(attendant).not.toContain("/estoque/importar-nfe");
    expect(attendant).not.toContain("/fechamento-fiscal");
    expect(buildNav("ATTENDANT").accountItems).toEqual([]);
    expect(stockModuleItems(false).map((i) => i.to)).toEqual(["/estoque", "/estoque/movimentos"]);
  });

  it("perfil de evento mostra só crediário e clientes ao atendente", () => {
    const nav = buildNav("ATTENDANT", true);
    expect(nav.groups.flatMap((g) => g.items).map((i) => i.to)).toEqual(["/crediario", "/clientes"]);
    expect(bottomNavItems(true).map((i) => i.to)).toEqual(["/crediario", "/clientes"]);
  });

  it("marca recursos de plano", () => {
    const items = buildNav("ADMIN").groups.flatMap((g) => g.items);
    expect(items.find((i) => i.to === "/estoque/alertas")?.feature).toBe("stockAlerts");
  });
});
