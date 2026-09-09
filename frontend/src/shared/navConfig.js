/**
 * Fonte única da hierarquia de navegação (sidebar + abas de módulo).
 * Não altera permissões de API — só o que aparece na UI.
 */

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

export function fiscalModuleItems(isAdmin) {
  const items = [{ to: "/fiscal/notas", label: "Notas fiscais" }];
  if (isAdmin) {
    items.push({ to: "/fechamento-fiscal", label: "Fechamento fiscal" });
  }
  return items;
}
