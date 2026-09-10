import { useEffect, useState } from "react";
import { apiClient } from "../apiClient.js";
import { useAuth } from "../../features/auth/useAuth.jsx";

/** Troca de loja no mesmo e-mail (plano Enterprise). */
export function StoreSwitcher() {
  const { token, tenant, acceptSession } = useAuth();
  const [payload, setPayload] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    apiClient("/auth/stores", { token })
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
    <label className="hidden min-w-0 sm:block">
      <span className="sr-only">Trocar loja</span>
      <select
        aria-label="Trocar loja"
        className="max-w-[10rem] truncate rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
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
