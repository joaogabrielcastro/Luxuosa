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

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route path="/" element={<PrivateShell><AdminDashboardPage /></PrivateShell>} />
      <Route path="/catalog/categories" element={<PrivateShell><CategoriesPage /></PrivateShell>} />
      <Route path="/catalog/brands" element={<PrivateShell><BrandsPage /></PrivateShell>} />
      <Route path="/catalog/products" element={<PrivateShell><ProductsPage /></PrivateShell>} />
      <Route path="/catalog/variations" element={<Navigate to="/catalog/products" replace />} />
      <Route path="/sales" element={<Navigate to="/vendas" replace />} />
      <Route path="/stock" element={<Navigate to="/estoque/movimentos" replace />} />
      <Route path="/reports" element={<Navigate to="/relatorios" replace />} />
      <Route path="/vendas" element={<PrivateShell><SalesPage /></PrivateShell>} />
      <Route path="/crediario" element={<PrivateShell><CrediarioPage /></PrivateShell>} />
      <Route path="/clientes" element={<PrivateShell><CustomersPage /></PrivateShell>} />
      <Route path="/estoque" element={<PrivateShell><StockOverviewPage /></PrivateShell>} />
      <Route path="/estoque/movimentos" element={<PrivateShell><StockMovementsPage /></PrivateShell>} />
      <Route path="/estoque/importar-nfe" element={<PrivateShell><NfeImportPage /></PrivateShell>} />
      <Route path="/estoque/alertas" element={<PrivateShell><StockAlertsPage /></PrivateShell>} />
      <Route path="/caixa" element={<PrivateShell><CashPage /></PrivateShell>} />
      <Route path="/relatorios" element={<PrivateShell><ReportsPage /></PrivateShell>} />
      <Route path="/fiscal" element={<Navigate to="/vendas?aba=notas" replace />} />
      <Route path="/fiscal/notas" element={<Navigate to="/vendas?aba=notas" replace />} />
      <Route path="/fechamento-fiscal" element={<PrivateShell><FiscalClosingPage /></PrivateShell>} />
      <Route path="/configuracoes" element={<PrivateShell><SettingsPage /></PrivateShell>} />
      <Route path="/assinatura" element={<PrivateShell><BillingPage /></PrivateShell>} />
      <Route path="/usuarios" element={<PrivateShell><UsersPage /></PrivateShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppRoutes />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
