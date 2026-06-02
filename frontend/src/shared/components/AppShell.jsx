import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../features/auth/useAuth.jsx";
import { BrandLogo } from "./BrandLogo.jsx";
import { FiscalEmitenteBanner } from "./FiscalEmitenteBanner.jsx";
import { Button } from "./ui/Button.jsx";
import {
  BarChart3,
  Boxes,
  LayoutGrid,
  LogOut,
  Menu,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  Tags,
  Users,
  WalletCards,
  X
} from "lucide-react";

const navGroups = [
  {
    label: "Visão geral",
    items: [{ to: "/", label: "Dashboard", end: true, icon: LayoutGrid }]
  },
  {
    label: "Catálogo",
    items: [
      { to: "/catalog/categories", label: "Categorias", icon: Tags },
      { to: "/catalog/brands", label: "Marcas", icon: Boxes },
      { to: "/catalog/products", label: "Produtos", icon: PackageSearch }
    ]
  },
  {
    label: "Vendas",
    items: [
      { to: "/vendas", label: "Vendas", icon: ShoppingCart },
      { to: "/crediario", label: "Crediário", icon: WalletCards },
      { to: "/clientes", label: "Clientes", icon: Users }
    ]
  },
  {
    label: "Operação",
    items: [
      { to: "/estoque/movimentos", label: "Estoque", icon: BarChart3 },
      { to: "/relatorios", label: "Relatórios", icon: ReceiptText }
    ]
  }
];

const roleLabel = {
  ADMIN: "Administrador",
  ATTENDANT: "Atendente"
};

export function AppShell({ children }) {
  const { tenant, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const content = children ?? <Outlet />;

  return (
    <div className="min-h-screen text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <BrandLogo compact tenant={tenant} />
            <div className="min-w-0 border-l border-slate-200 pl-3">
              <p className="truncate text-sm font-semibold leading-tight text-slate-900">{tenant?.name ?? "—"}</p>
              <p className="truncate text-xs text-slate-500">{user?.name ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 sm:inline-flex">
              {roleLabel[user?.type] ?? user?.type ?? "—"}
            </span>
            <Button
              variant="secondary"
              className="hidden gap-1.5 px-3 py-1.5 text-xs sm:inline-flex"
              onClick={logout}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
            <Button variant="ghost" className="px-2 py-1.5 sm:hidden" onClick={logout} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] gap-0 lg:gap-6 lg:px-6 lg:py-5">
        {menuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(280px,88vw)] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out lg:static lg:z-0 lg:w-60 lg:shrink-0 lg:translate-x-0 lg:border-0 lg:bg-transparent lg:shadow-none ${
            menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 lg:hidden">
            <span className="text-sm font-semibold text-slate-900">Menu</span>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 lg:p-0" aria-label="Navegação principal">
            {navGroups.map((group) => (
              <div key={group.label} className="mb-4 last:mb-0">
                <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        isActive ? "ui-nav-active ui-nav-item" : "ui-nav-item"
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-slate-100 p-3 lg:hidden">
            <p className="text-center text-[10px] text-slate-400">Luxuosa — gestão da loja</p>
          </div>
        </aside>

        <main className="ui-page min-w-0 flex-1 px-4 py-5 lg:px-0 lg:py-0">
          <FiscalEmitenteBanner />
          {content}
        </main>
      </div>

      {import.meta.env.VITE_GIT_SHA ? (
        <footer className="mx-auto max-w-[1440px] px-6 pb-4 text-center text-[10px] text-slate-400">
          Versão {String(import.meta.env.VITE_GIT_SHA).slice(0, 7)}
        </footer>
      ) : null}
    </div>
  );
}
