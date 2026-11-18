import { useEffect, useState } from "react";
import { apiClient } from "../apiClient.js";
import { useAuth } from "../../features/auth/useAuth.jsx";

/** Troca de loja no mesmo e-mail (plano Enterprise). */
export function StoreSwitcher({ className = "" }) {
  const { token, tenant, acceptSession } = useAuth();
  const [payload, setPayload] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    Promise.resolve(apiClient("/auth/stores", { token }))
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const stores = payload?.stores ?? [];
  if (!payload?.canSwitch || stores.length < 2) return null;

  async function onChange(e) {
    const tenantId = e.target.value;
    if (!tenantId || tenantId === tenant?.id || busy) return;
    setBusy(true);
    try {
      const data = await apiClient("/auth/switch-store", {
        method: "POST",
        token,
        body: { tenantId }
      });
      acceptSession?.(data);
      window.location.href = "/";
    } catch {
      setBusy(false);
    }
  }

  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="ui-eyebrow mb-1 block">Loja</span>
      <select
        aria-label="Trocar loja"
        className="ui-input min-h-9 truncate py-1.5 text-[13px]"
        value={tenant?.id || ""}
        disabled={busy}
        onChange={onChange}
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </label>
  );
}
