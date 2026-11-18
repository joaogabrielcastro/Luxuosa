/**
 * Fonte única da hierarquia de navegação (sidebar, barra inferior mobile e abas de módulo).
 * Não altera permissões de API — só o que aparece na UI.
 */
import {
  ArrowLeftRight,
  BarChart3,
  BellRing,
  Boxes,
  ClipboardList,
  CreditCard,
  FileArchive,
  FileInput,
  History,
  LayoutGrid,
  PackageSearch,
  ReceiptText,
  Settings,
  ShoppingBag,
  UserCog,
  Users,
  Wallet,
  WalletCards
} from "lucide-react";

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
  return null;
}

/**
 * Menu principal.
 * - `feature`: recurso de plano; quando indisponível o item aparece com cadeado (a página explica o upgrade).
 * - `end`: ativo só na rota exata.
 */
export function buildNav(userType, eventOnly = false) {
  const isAdmin = userType === "ADMIN";

  const accountItems = isAdmin
    ? [
        { to: "/configuracoes", label: "Configurações", icon: Settings },
        { to: "/usuarios", label: "Usuários", icon: UserCog },
        { to: "/auditoria", label: "Auditoria", icon: ClipboardList },
        { to: "/assinatura", label: "Assinatura", icon: CreditCard }
      ]
    : [];

  if (eventOnly) {
    return {
      groups: [
        {
          label: "Evento",
          items: [
            { to: "/crediario", label: "Crediário", icon: WalletCards },
            { to: "/clientes", label: "Clientes", icon: Users }
          ]
        },
        ...(isAdmin
          ? [
              {
                label: "Administração",
                items: [
                  { to: "/catalog/products", label: "Produtos", icon: PackageSearch },
                  { to: "/estoque", label: "Estoque", icon: Boxes, end: true },
                  { to: "/relatorios", label: "Relatórios", icon: BarChart3 }
                ]
              }
            ]
          : [])
      ],
      accountItems
    };
  }

  const groups = [
    {
      label: null,
      items: [{ to: "/", label: "Início", end: true, icon: LayoutGrid }]
    },
    {
      label: "Vender",
      items: [
        { to: "/vendas", label: "PDV", end: true, icon: ShoppingBag },
        { to: "/vendas/historico", label: "Vendas", icon: History },
        { to: "/crediario", label: "Crediário", icon: WalletCards },
        { to: "/clientes", label: "Clientes", icon: Users }
      ]
    },
    {
      label: "Catálogo e estoque",
      items: [
        {
          to: "/catalog/products",
          label: "Produtos",
          icon: PackageSearch,
          children: [
            { to: "/catalog/categories", label: "Categorias" },
            { to: "/catalog/brands", label: "Marcas" }
          ]
        },
        { to: "/estoque", label: "Estoque", end: true, icon: Boxes },
        { to: "/estoque/movimentos", label: "Movimentações", icon: ArrowLeftRight },
        ...(isAdmin
          ? [
              { to: "/estoque/importar-nfe", label: "Entradas NF-e", icon: FileInput, feature: "nfeImport" },
              { to: "/estoque/alertas", label: "Alertas", icon: BellRing, feature: "stockAlerts" }
            ]
          : [])
      ]
    },
    {
      label: "Financeiro",
      items: [
        { to: "/caixa", label: "Caixa", icon: Wallet },
        { to: "/relatorios", label: "Relatórios", icon: BarChart3 }
      ]
    },
    {
      label: "Fiscal",
      items: [
        { to: "/fiscal/notas", label: "Notas fiscais", icon: ReceiptText },
        ...(isAdmin
          ? [{ to: "/fechamento-fiscal", label: "Fechamento fiscal", icon: FileArchive, feature: "fiscalClosing" }]
          : [])
      ]
    }
  ];

  return { groups, accountItems };
}

/** Atalhos da barra inferior no celular (o último botão abre o menu completo). */
export function bottomNavItems(eventOnly = false) {
  if (eventOnly) {
    return [
      { to: "/crediario", label: "Crediário", icon: WalletCards },
      { to: "/clientes", label: "Clientes", icon: Users }
    ];
  }
  return [
    { to: "/", label: "Início", icon: LayoutGrid, end: true },
    { to: "/vendas", label: "Vender", icon: ShoppingBag, end: true, primary: true },
    { to: "/catalog/products", label: "Produtos", icon: PackageSearch },
    { to: "/clientes", label: "Clientes", icon: Users }
  ];
}

export function catalogModuleItems(eventOnly = false) {
  if (eventOnly) return [{ to: "/catalog/products", label: "Produtos" }];
  return [
    { to: "/catalog/products", label: "Produtos" },
    { to: "/catalog/categories", label: "Categorias" },
    { to: "/catalog/brands", label: "Marcas" }
  ];
}

export function stockModuleItems(isAdmin, eventOnly = false) {
  if (eventOnly) return [{ to: "/estoque", label: "Visão geral", end: true }];
  const items = [
    { to: "/estoque", label: "Visão geral", end: true },
    { to: "/estoque/movimentos", label: "Movimentações" }
  ];
  if (isAdmin) {
    items.push(
      { to: "/estoque/importar-nfe", label: "Entradas NF-e", feature: "nfeImport" },
      { to: "/estoque/alertas", label: "Alertas", feature: "stockAlerts" }
    );
  }
  return items;
}

export function salesModuleItems() {
  return [
    { to: "/vendas", label: "PDV", end: true },
    { to: "/vendas/historico", label: "Histórico de vendas" }
  ];
}

export function fiscalModuleItems(isAdmin) {
  const items = [{ to: "/fiscal/notas", label: "Notas fiscais" }];
  if (isAdmin) {
    items.push({ to: "/fechamento-fiscal", label: "Fechamento fiscal", feature: "fiscalClosing" });
  }
  return items;
}
