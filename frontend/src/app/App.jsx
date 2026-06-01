import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "../features/auth/useAuth.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
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
const StockMovementsPage = lazy(() =>
  import("../features/stock/StockMovementsPage.jsx").then((m) => ({ default: m.StockMovementsPage }))
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
      <Route path="/estoque/movimentos" element={<PrivateShell><StockMovementsPage /></PrivateShell>} />
      <Route path="/relatorios" element={<PrivateShell><ReportsPage /></PrivateShell>} />
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
