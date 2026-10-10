import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "../features/auth/useAuth.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { RegisterPage } from "../features/auth/RegisterPage.jsx";
import { AppShell } from "../shared/components/AppShell.jsx";
import { PageLoader } from "../shared/components/PageLoader.jsx";
import { ToastProvider } from "../shared/components/ToastProvider.jsx";
import { ConfirmProvider } from "../shared/components/ConfirmProvider.jsx";
import { QueryProvider } from "../shared/QueryProvider.jsx";
import { PwaInstallProvider } from "../shared/pwa/PwaInstallProvider.jsx";
import { InstallAppDialog } from "../shared/pwa/InstallAppDialog.jsx";

const AdminDashboardPage = lazy(() =>
  import("../features/dashboard/AdminDashboardPage.jsx").then((m) => ({ default: m.AdminDashboardPage }))
);
const CategoriesPage = lazy(() =>
  import("../features/catalog/CategoriesPage.jsx").then((m) => ({ default: m.CategoriesPage }))
);
const BrandsPage = lazy(() =>
  import("../features/catalog/BrandsPage.jsx").then((m) => ({ default: m.BrandsPage }))
);
const ProductsPage = lazy(() =>
  import("../features/catalog/ProductsPage.jsx").then((m) => ({ default: m.ProductsPage }))
);
const SalesPage = lazy(() =>
  import("../features/sales/NfceSalesPage.jsx").then((m) => ({ default: m.SalesPage }))
);
const StockOverviewPage = lazy(() =>
  import("../features/stock/StockOverviewPage.jsx").then((m) => ({ default: m.StockOverviewPage }))
);
const StockMovementsPage = lazy(() =>
  import("../features/stock/StockMovementsPage.jsx").then((m) => ({ default: m.StockMovementsPage }))
);
const NfeImportPage = lazy(() =>
  import("../features/stock/NfeImportPage.jsx").then((m) => ({ default: m.NfeImportPage }))
);
const ReportsPage = lazy(() =>
  import("../features/reports/ReportsPage.jsx").then((m) => ({ default: m.ReportsPage }))
);
const CrediarioPage = lazy(() =>
  import("../features/crediario/CrediarioPage.jsx").then((m) => ({ default: m.CrediarioPage }))
);
const CustomersPage = lazy(() =>
  import("../features/customers/CustomersPage.jsx").then((m) => ({ default: m.CustomersPage }))
);
const BillingPage = lazy(() =>
  import("../features/billing/BillingPage.jsx").then((m) => ({ default: m.BillingPage }))
);
const UsersPage = lazy(() =>
  import("../features/users/UsersPage.jsx").then((m) => ({ default: m.UsersPage }))
);
const CashPage = lazy(() =>
  import("../features/cash/CashPage.jsx").then((m) => ({ default: m.CashPage }))
);
const StockAlertsPage = lazy(() =>
  import("../features/stock/StockAlertsPage.jsx").then((m) => ({ default: m.StockAlertsPage }))
);
const FiscalClosingPage = lazy(() =>
  import("../features/fiscal/FiscalClosingPage.jsx").then((m) => ({ default: m.FiscalClosingPage }))
);
const SettingsPage = lazy(() =>
  import("../features/settings/SettingsPage.jsx").then((m) => ({ default: m.SettingsPage }))
);
const AuditLogsPage = lazy(() =>
  import("../features/audit/AuditLogsPage.jsx").then((m) => ({ default: m.AuditLogsPage }))
);

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

const EVENT_ONLY_PATHS = ["/crediario", "/clientes", "/catalog/products", "/estoque", "/relatorios", "/configuracoes", "/auditoria", "/usuarios", "/assinatura"];

function TenantProfileRoute({ path, children }) {
  const { tenant, user } = useAuth();
  if (tenant?.creditEventOnly !== true) return children;
  const allowed = EVENT_ONLY_PATHS.includes(path);
  if (!allowed || (user?.type !== "ADMIN" && !["/crediario", "/clientes"].includes(path))) {
    return <Navigate to="/crediario" replace />;
  }
  return children;
}

/** Layout + página numa única árvore — evita Outlet aninhado (tela branca em /vendas). */
function PrivateShell({ children }) {
  return (
    <PrivateRoute>
      <AppShell>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </AppShell>
    </PrivateRoute>
  );
}

function ProfiledShell({ path, children }) {
  return <TenantProfileRoute path={path}><PrivateShell>{children}</PrivateShell></TenantProfileRoute>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route path="/" element={<ProfiledShell path="/"><AdminDashboardPage /></ProfiledShell>} />
      <Route path="/catalog/categories" element={<ProfiledShell path="/catalog/categories"><CategoriesPage /></ProfiledShell>} />
      <Route path="/catalog/brands" element={<ProfiledShell path="/catalog/brands"><BrandsPage /></ProfiledShell>} />
      <Route path="/catalog/products" element={<ProfiledShell path="/catalog/products"><ProductsPage /></ProfiledShell>} />
      <Route path="/catalog/variations" element={<Navigate to="/catalog/products" replace />} />
      <Route path="/sales" element={<Navigate to="/vendas" replace />} />
      <Route path="/stock" element={<Navigate to="/estoque/movimentos" replace />} />
      <Route path="/reports" element={<Navigate to="/relatorios" replace />} />
      <Route path="/vendas" element={<ProfiledShell path="/vendas"><SalesPage /></ProfiledShell>} />
      <Route path="/crediario" element={<ProfiledShell path="/crediario"><CrediarioPage /></ProfiledShell>} />
      <Route path="/clientes" element={<ProfiledShell path="/clientes"><CustomersPage /></ProfiledShell>} />
      <Route path="/estoque" element={<ProfiledShell path="/estoque"><StockOverviewPage /></ProfiledShell>} />
      <Route path="/estoque/movimentos" element={<ProfiledShell path="/estoque/movimentos"><StockMovementsPage /></ProfiledShell>} />
      <Route path="/estoque/importar-nfe" element={<ProfiledShell path="/estoque/importar-nfe"><NfeImportPage /></ProfiledShell>} />
      <Route path="/estoque/alertas" element={<ProfiledShell path="/estoque/alertas"><StockAlertsPage /></ProfiledShell>} />
      <Route path="/caixa" element={<ProfiledShell path="/caixa"><CashPage /></ProfiledShell>} />
      <Route path="/relatorios" element={<ProfiledShell path="/relatorios"><ReportsPage /></ProfiledShell>} />
      <Route path="/fiscal" element={<Navigate to="/vendas?aba=notas" replace />} />
      <Route path="/fiscal/notas" element={<Navigate to="/vendas?aba=notas" replace />} />
      <Route path="/fechamento-fiscal" element={<ProfiledShell path="/fechamento-fiscal"><FiscalClosingPage /></ProfiledShell>} />
      <Route path="/configuracoes" element={<ProfiledShell path="/configuracoes"><SettingsPage /></ProfiledShell>} />
      <Route path="/auditoria" element={<ProfiledShell path="/auditoria"><AuditLogsPage /></ProfiledShell>} />
      <Route path="/assinatura" element={<ProfiledShell path="/assinatura"><BillingPage /></ProfiledShell>} />
      <Route path="/usuarios" element={<ProfiledShell path="/usuarios"><UsersPage /></ProfiledShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryProvider>
      <PwaInstallProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AppRoutes />
              <InstallAppDialog />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </PwaInstallProvider>
    </QueryProvider>
  );
}
