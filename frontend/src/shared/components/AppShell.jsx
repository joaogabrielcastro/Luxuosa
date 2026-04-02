import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../features/auth/useAuth.jsx";
import { BrandLogo } from "./BrandLogo.jsx";
import { Button } from "./ui/Button.jsx";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutGrid,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  Tags,
  Users,
  WalletCards
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", end: true, icon: LayoutGrid },
  { to: "/catalog/categories", label: "Categorias", icon: Tags },
  { to: "/catalog/brands", label: "Marcas", icon: Boxes },
  { to: "/catalog/products", label: "Produtos", icon: PackageSearch },
  { to: "/catalog/variations", label: "Variacoes", icon: ClipboardList },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart },
  { to: "/crediario", label: "Crediario", icon: WalletCards },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/estoque/movimentos", label: "Estoque", icon: BarChart3 },
  { to: "/relatorios", label: "Relatorios", icon: ReceiptText }
];

export function AppShell({ children }) {
  const { tenant, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="shrink-0 rounded-md border border-slate-200 p-2 text-slate-700 md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Abrir menu"
            >
              ☰
            </button>
            <BrandLogo compact tenant={tenant} />
            <div className="min-w-0 flex-1 sm:flex-none">
              <p className="truncate text-sm font-semibold leading-tight text-slate-900">{tenant?.name ?? "—"}</p>
              <p className="truncate text-xs text-slate-500">{user?.name ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 md:inline-flex">
              {user?.type === "ADMIN" ? "Administrador" : "Atendente"}
            </span>
            <Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-4 p-4 md:grid-cols-[240px_1fr]">
        <aside
          className={`ui-surface h-fit p-3 md:sticky md:top-[76px] ${
            menuOpen ? "block" : "hidden md:block"
          }`}
        >
          <div className="mb-3 px-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Navegacao</p>
          </div>
          <nav className="grid grid-cols-1 gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-gradient-to-r from-[#7C3AED] to-[#1E40AF] text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                <span className="inline-flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="ui-page">
          {children ?? <Outlet />}
        </section>
      </div>
    </div>
  );
}
