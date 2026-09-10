/**
 * Fonte única da hierarquia de navegação (sidebar + abas de módulo).
 * Não altera permissões de API — só o que aparece na UI.
 */

/** Ativo customizado para rotas que compartilham pathname e diferem no search. */
export function isNavItemActive(item, location) {
  const raw = String(item.to || "");
  const qIndex = raw.indexOf("?");
  const pathname = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const search = qIndex >= 0 ? raw.slice(qIndex + 1) : "";
  const wantAba = new URLSearchParams(search).get("aba");
  const gotAba = new URLSearchParams(location.search).get("aba");
  if (wantAba) {
    return location.pathname === pathname && gotAba === wantAba;
  }
  if (pathname === "/vendas") {
    return location.pathname === "/vendas" && gotAba !== "notas";
  }
  return null;
}

export function catalogModuleItems() {
  return [
    { to: "/catalog/products", label: "Produtos" },
    { to: "/catalog/categories", label: "Categorias" },
    { to: "/catalog/brands", label: "Marcas" }
  ];
}

export function stockModuleItems(isAdmin) {
  const items = [
    { to: "/estoque", label: "Estoque", end: true },
    { to: "/estoque/movimentos", label: "Movimentações" }
  ];
  if (isAdmin) {
    items.push(
      { to: "/estoque/importar-nfe", label: "Entradas" },
      { to: "/estoque/alertas", label: "Alertas" }
    );
  }
  return items;
}

export function salesModuleItems() {
  return [
    { to: "/vendas", label: "PDV" },
    { to: "/vendas?aba=notas", label: "Notas fiscais" }
  ];
}

export function fiscalModuleItems(isAdmin) {
  const items = [{ to: "/vendas?aba=notas", label: "Notas fiscais" }];
  if (isAdmin) {
    items.push({ to: "/fechamento-fiscal", label: "Fechamento fiscal" });
  }
  return items;
}
