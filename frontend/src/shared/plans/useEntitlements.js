import { useMemo } from "react";
import { useAuth } from "../../features/auth/useAuth.jsx";
import { resolveEntitlements } from "./plans.js";

export function useEntitlements() {
  const { tenant } = useAuth();
  return useMemo(() => resolveEntitlements(tenant), [tenant]);
}
