import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("luxuosa_session");
    return raw ? JSON.parse(raw) : null;
  });

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

  async function login(email, password) {
    const body = { email, password };
    const data = await apiClient("/auth/login", {
      method: "POST",
      body
    });
    setSession(data);
    localStorage.setItem("luxuosa_session", JSON.stringify(data));
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
      logout
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
