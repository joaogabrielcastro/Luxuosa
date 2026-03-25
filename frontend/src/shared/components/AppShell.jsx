import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../features/auth/useAuth.jsx";
import { BrandLogo } from "./BrandLogo.jsx";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/catalog/categories", label: "Categorias" },
  { to: "/catalog/products", label: "Produtos" },
  { to: "/catalog/variations", label: "Variacoes" },
  { to: "/vendas", label: "Vendas" },
  { to: "/estoque/movimentos", label: "Estoque" },
  { to: "/relatorios", label: "Relatorios" }
];

export function AppShell({ children }) {
  const { tenant, user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <BrandLogo />
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{tenant?.name}</p>
            <p className="text-xs text-slate-500">{user?.name}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-3 py-3 sm:px-4 sm:py-4 md:grid-cols-[220px_1fr]">
        <aside className="rounded-lg bg-white p-3 shadow-sm">
          <nav className="grid grid-cols-2 gap-1 md:grid-cols-1 md:space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-center text-sm md:text-left ${isActive ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button className="mt-4 w-full rounded-md border px-3 py-2 text-sm" onClick={logout}>
            Sair
          </button>
        </aside>

        <section>
          {children ?? <Outlet />}
        </section>
      </div>
    </div>
  );
}
