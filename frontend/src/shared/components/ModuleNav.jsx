import { NavLink, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { isNavItemActive } from "../navConfig.js";
import { useEntitlements } from "../plans/useEntitlements.js";
import { cn } from "./ui/helpers.js";

/** Abas horizontais dentro de um módulo (desktop e mobile). */
export function ModuleNav({ items, label = "Seções do módulo" }) {
  const location = useLocation();
  const { has } = useEntitlements();
  if (!items?.length) return null;
  return (
    <nav
      className="ui-scrollbar-none -mx-4 flex gap-0.5 overflow-x-auto px-4 sm:mx-0 sm:inline-flex sm:max-w-full sm:rounded-lg sm:bg-slate-900/[0.04] sm:p-0.5"
      aria-label={label}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => {
            const custom = isNavItemActive(item, location);
            const active = custom === null ? isActive : custom;
            return cn("ui-tab", active && "ui-tab-active");
          }}
        >
          {item.label}
          {item.feature && !has(item.feature) ? <Lock className="h-3 w-3 text-champagne-600" aria-hidden /> : null}
        </NavLink>
      ))}
    </nav>
  );
}
