import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Lock, LogOut, Menu, MonitorDown, MoreHorizontal, ShoppingBag, X } from "lucide-react";
import { useAuth } from "../../features/auth/useAuth.jsx";
import { BrandLogo } from "./BrandLogo.jsx";
import { StoreSwitcher } from "./StoreSwitcher.jsx";
import { bottomNavItems, buildNav, isNavItemActive } from "../navConfig.js";
import { usePwaInstall } from "../pwa/PwaInstallProvider.jsx";
import { useEntitlements } from "../plans/useEntitlements.js";
import { PlanBadge } from "../plans/PlanGate.jsx";
import { cn } from "./ui/helpers.js";

const roleLabel = {
  ADMIN: "Administrador",
  ATTENDANT: "Atendente"
};

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function NavItem({ item, onNavigate, locked }) {
  const location = useLocation();
  const childActive = item.children?.some((c) => location.pathname === c.to);
  return (
    <div>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) => {
          const custom = isNavItemActive(item, location);
          const active = custom === null ? isActive : custom;
          return cn("ui-nav-item", active && "ui-nav-active");
        }}
      >
        {item.icon ? <item.icon className="h-[18px] w-[18px] shrink-0 text-slate-500" aria-hidden /> : null}
        <span className="flex-1 truncate">{item.label}</span>
        {locked ? <Lock className="h-3.5 w-3.5 text-champagne-600" aria-label="Recurso de outro plano" /> : null}
      </NavLink>
      {item.children?.length && (location.pathname.startsWith("/catalog") || childActive) ? (
        <div className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.end}
              onClick={onNavigate}
              className={({ isActive }) => cn("ui-nav-item ui-nav-sub", isActive && "ui-nav-active")}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SidebarContent({ groups, accountItems, onNavigate, has, onInstall, installed, onLogout, user, tenant, plan }) {
  return (
    <>
      <nav className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3" aria-label="Navegação principal">
        {groups.map((group, gi) => (
          <div key={group.label || `g${gi}`} className="mb-4 last:mb-0">
            {group.label ? <p className="ui-eyebrow mb-1.5 px-3 pt-1">{group.label}</p> : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={onNavigate} locked={item.feature ? !has(item.feature) : false} />
              ))}
            </div>
          </div>
        ))}
        {accountItems.length ? (
          <div className="mt-4">
            <p className="ui-eyebrow mb-1.5 px-3 pt-1">Conta</p>
            <div className="space-y-0.5">
              {accountItems.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ) : null}
      </nav>

      <div className="space-y-1 border-t border-slate-200/70 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {!installed ? (
          <button type="button" className="ui-nav-item w-full text-left" onClick={onInstall}>
            <MonitorDown className="h-[18px] w-[18px] shrink-0 text-slate-500" aria-hidden />
            Instalar aplicativo
          </button>
        ) : null}
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
            {initials(user?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{user?.name ?? "—"}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="truncate text-xs text-slate-500">{roleLabel[user?.type] ?? user?.type ?? "—"}</span>
              {tenant ? <PlanBadge plan={plan} /> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-900/[0.05] hover:text-slate-900"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}

function BottomNav({ items, onMore }) {
  const location = useLocation();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Atalhos"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => {
              const custom = isNavItemActive(item, location);
              const active = custom === null ? isActive : custom;
              return cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-2xs font-medium",
                active ? "text-brand-800" : "text-slate-500"
              );
            }}
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    isActive ? "bg-brand-100" : ""
                  )}
                >
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onMore}
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-2xs font-medium text-slate-500"
        >
          <span className="flex h-7 w-12 items-center justify-center">
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </span>
          Mais
        </button>
      </div>
    </nav>
  );
}

export function AppShell({ children }) {
  const { tenant, user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const eventOnly = tenant?.creditEventOnly === true;
  const { groups, accountItems } = useMemo(() => buildNav(user?.type, eventOnly), [user?.type, eventOnly]);
  const bottomItems = useMemo(() => bottomNavItems(eventOnly), [eventOnly]);
  const { installed, openInstall } = usePwaInstall();
  const { has, plan } = useEntitlements();
  /** PDV em modo foco no celular/tablet: sem barra inferior (o carrinho ocupa o rodapé). */
  const focusMode = location.pathname === "/vendas";

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const content = children ?? <Outlet />;
  const closeMenu = () => setMenuOpen(false);
  const sidebarProps = {
    groups,
    accountItems,
    has,
    installed,
    user,
    tenant,
    plan,
    onNavigate: closeMenu,
    onInstall: () => {
      closeMenu();
      openInstall();
    },
    onLogout: () => {
      closeMenu();
      logout();
    }
  };

  return (
    <div className="min-h-dvh overflow-x-hidden text-slate-900 lg:pl-[var(--sidebar-w)]">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] flex-col border-r border-slate-200/70 bg-[rgb(var(--neutral-100))] lg:flex">
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <BrandLogo compact tenant={tenant} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-slate-900">{tenant?.name ?? "—"}</p>
            <p className="font-display text-[15px] leading-tight text-slate-500">Luxuosa</p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <StoreSwitcher className="w-full" />
        </div>
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Topo mobile/tablet */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center gap-2 px-2 sm:px-4">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-900/[0.05]"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <BrandLogo compact tenant={tenant} />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{tenant?.name ?? "—"}</p>
          {!eventOnly && !focusMode ? (
            <NavLink to="/vendas" className="ui-btn ui-btn-primary ui-btn-sm" aria-label="Nova venda">
              <ShoppingBag className="h-4 w-4" aria-hidden />
              <span className="hidden min-[380px]:inline">Vender</span>
            </NavLink>
          ) : null}
        </div>
      </header>

      {/* Drawer mobile */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] animate-fade-in"
            aria-label="Fechar menu"
            onClick={closeMenu}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(320px,88vw)] flex-col bg-[rgb(var(--neutral-100))] shadow-pop animate-fade-in">
            <div className="flex items-center gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
              <BrandLogo compact tenant={tenant} />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{tenant?.name ?? "—"}</p>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-900/[0.05]"
                onClick={closeMenu}
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 pb-3">
              <StoreSwitcher className="w-full" />
            </div>
            <SidebarContent {...sidebarProps} />
          </aside>
        </div>
      ) : null}

      <main
        className={cn(
          "min-w-0 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10 lg:pt-8",
          focusMode ? "pb-28 lg:pb-10" : "pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
        )}
      >
        {content}
        {import.meta.env.VITE_GIT_SHA ? (
          <footer className="mt-10 text-center text-[10px] text-slate-400">
            Versão {String(import.meta.env.VITE_GIT_SHA).slice(0, 7)}
          </footer>
        ) : null}
      </main>

      {!focusMode ? <BottomNav items={bottomItems} onMore={() => setMenuOpen(true)} /> : null}
    </div>
  );
}
