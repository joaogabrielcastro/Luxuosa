import { NavLink, useLocation } from "react-router-dom";
import { isNavItemActive } from "../navConfig.js";

/** Abas horizontais dentro de um módulo (desktop e mobile). */
export function ModuleNav({ items, label = "Seções do módulo" }) {
  const location = useLocation();
  if (!items?.length) return null;
  return (
    <nav className="-mt-2 flex flex-wrap gap-1 border-b border-slate-200 pb-3" aria-label={label}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => {
            const custom = isNavItemActive(item, location);
            const active = custom === null ? isActive : custom;
            return active
              ? "rounded-lg bg-violet-100 px-3 py-1.5 text-sm font-semibold text-violet-900"
              : "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";
          }}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
