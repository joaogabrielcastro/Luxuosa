import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient, AUTH_UNAUTHORIZED_EVENT } from "../../shared/apiClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("luxuosa_session");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    function onUnauthorized() {
      setSession(null);
      localStorage.removeItem("luxuosa_session");
    }
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  useEffect(() => {
    const t = session?.token;
    if (!t) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient("/auth/me", { token: t });
        if (cancelled) return;
        setSession((prev) => {
          if (!prev?.token) return prev;
          const next = { ...prev, user: data.user, tenant: data.tenant };
          localStorage.setItem("luxuosa_session", JSON.stringify(next));
          return next;
        });
      } catch {
        /* mantem sessao local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  async function login(email, password, tenantCnpj) {
    const body = { email, password };
    const cnpj = String(tenantCnpj || "").replace(/\D/g, "");
    if (cnpj.length === 14) body.tenantCnpj = cnpj;
    const data = await apiClient("/auth/login", {
      method: "POST",
      body
    });
    acceptSession(data);
    return data;
  }

  function acceptSession(data) {
    setSession(data);
    localStorage.setItem("luxuosa_session", JSON.stringify(data));
    return data;
  }

  async function refreshSession() {
    const t = session?.token;
    if (!t) return null;
    const data = await apiClient("/auth/me", { token: t });
    const next = { ...session, user: data.user, tenant: data.tenant };
    setSession(next);
    localStorage.setItem("luxuosa_session", JSON.stringify(next));
    return next;
  }

  function logout() {
    setSession(null);
    localStorage.removeItem("luxuosa_session");
  }

  const value = useMemo(
    () => ({
      session,
      token: session?.token,
      tenant: session?.tenant,
      user: session?.user,
      login,
      acceptSession,
      logout,
      refreshSession
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado com AuthProvider");
  return context;
}
