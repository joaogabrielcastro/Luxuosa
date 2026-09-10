import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../features/auth/useAuth.jsx";
import { BrandLogo } from "./BrandLogo.jsx";
import { Button } from "./ui/Button.jsx";
import { StoreSwitcher } from "./StoreSwitcher.jsx";
import { isNavItemActive } from "../navConfig.js";
import {
  ArrowLeftRight,
  BarChart3,
  BellRing,
  Boxes,
  CreditCard,
  FileArchive,
  FileInput,
  LayoutGrid,
  LogOut,
  Menu,
  PackageSearch,
  ReceiptText,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  WalletCards,
  X
} from "lucide-react";

function buildNav(userType) {
  const isAdmin = userType === "ADMIN";

  const groups = [
    {
      label: "Visão geral",
      items: [{ to: "/", label: "Início", end: true, icon: LayoutGrid }]
    },
    {
      label: "Vendas",
      items: [
        { to: "/vendas", label: "Vendas", icon: ShoppingCart },
        { to: "/clientes", label: "Clientes", icon: Users }
      ]
    },
    {
      label: "Catálogo",
      items: [
        {
          to: "/catalog/products",
          label: "Produtos",
          icon: PackageSearch,
          children: [
            { to: "/catalog/categories", label: "Categorias" },
            { to: "/catalog/brands", label: "Marcas" }
          ]
        }
      ]
    },
    {
      label: "Estoque",
      items: [
        { to: "/estoque", label: "Estoque", end: true, icon: Boxes },
        { to: "/estoque/movimentos", label: "Movimentações", icon: ArrowLeftRight },
        ...(isAdmin
          ? [
              { to: "/estoque/importar-nfe", label: "Entradas", icon: FileInput },
              { to: "/estoque/alertas", label: "Alertas", icon: BellRing }
            ]
          : [])
      ]
    },
    {
      label: "Financeiro",
      items: [
        { to: "/caixa", label: "Caixa", icon: Wallet },
        { to: "/crediario", label: "Crediário", icon: WalletCards }
      ]
    },
    {
      label: "Fiscal",
      items: [
        { to: "/vendas?aba=notas", label: "Notas fiscais", icon: ReceiptText },
        ...(isAdmin ? [{ to: "/fechamento-fiscal", label: "Fechamento fiscal", icon: FileArchive }] : [])
      ]
    },
    {
      label: "Relatórios",
      items: [{ to: "/relatorios", label: "Relatórios", icon: BarChart3 }]
    }
  ];

  const accountItems = isAdmin
    ? [
        { to: "/configuracoes", label: "Configurações", icon: Settings },
        { to: "/usuarios", label: "Usuários", icon: UserCog },
        { to: "/assinatura", label: "Assinatura", icon: CreditCard }
      ]
    : [];

  return { groups, accountItems };
}

const roleLabel = {
  ADMIN: "Administrador",
  ATTENDANT: "Atendente"
};

function NavItem({ item, onNavigate }) {
  const location = useLocation();
  return (
    <div>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) => {
          const custom = isNavItemActive(item, location);
          const active = custom === null ? isActive : custom;
          return active ? "ui-nav-item ui-nav-active" : "ui-nav-item";
        }}
      >
        {item.icon ? <item.icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden /> : null}
        {item.label}
      </NavLink>
      {item.children?.length ? (
        <div className="mb-0.5 ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                isActive ? "ui-nav-item ui-nav-sub ui-nav-active" : "ui-nav-item ui-nav-sub"
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }) {
  const { tenant, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { groups, accountItems } = useMemo(() => buildNav(user?.type), [user?.type]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const content = children ?? <Outlet />;
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex w-full items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <BrandLogo compact tenant={tenant} />
            <StoreSwitcher />
            <div className="min-w-0 border-l border-slate-200 pl-2 sm:pl-3">
              <p className="truncate text-sm font-semibold leading-tight text-slate-900">{tenant?.name ?? "—"}</p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{user?.name ?? "—"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 md:inline-flex">
              {roleLabel[user?.type] ?? user?.type ?? "—"}
            </span>
            <Button
              variant="secondary"
              className="hidden gap-1.5 px-3 py-1.5 text-xs lg:inline-flex"
              onClick={logout}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
            <Button variant="ghost" className="h-10 w-10 px-0 lg:hidden" onClick={logout} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-w-0 flex-1 lg:gap-4 xl:gap-6">
        {menuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
            aria-label="Fechar menu"
            onClick={closeMenu}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(300px,88vw)] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out lg:static lg:z-0 lg:w-56 lg:shrink-0 lg:translate-x-0 lg:border-0 lg:bg-transparent lg:py-5 lg:pl-3 lg:pr-1 lg:shadow-none xl:w-60 xl:pl-4 ${
            menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
            <span className="text-sm font-semibold text-slate-900">Menu</span>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              onClick={closeMenu}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto overscroll-contain p-3 lg:p-0 lg:pt-1" aria-label="Navegação principal">
            {groups.map((group) => (
              <div key={group.label} className="mb-4 last:mb-0">
                <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavItem key={item.to} item={item} onNavigate={closeMenu} />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:border-slate-200/80 lg:px-0 lg:pb-0 lg:pt-3">
            {accountItems.length ? (
              <div className="mb-2">
                <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Conta
                </p>
                <div className="space-y-0.5">
                  {accountItems.map((item) => (
                    <NavItem key={item.to} item={item} onNavigate={closeMenu} />
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="ui-nav-item w-full text-left"
              onClick={() => {
                closeMenu();
                logout();
              }}
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Sair
            </button>
          </div>
        </aside>

        <main className="ui-page min-w-0 w-full flex-1 px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-5 xl:px-8">
          {content}
        </main>
      </div>

      {import.meta.env.VITE_GIT_SHA ? (
        <footer className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[10px] text-slate-400 sm:px-4 lg:px-6 xl:px-8">
          Versão {String(import.meta.env.VITE_GIT_SHA).slice(0, 7)}
        </footer>
      ) : null}
    </div>
  );
}
