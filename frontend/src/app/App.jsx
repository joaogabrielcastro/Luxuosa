import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "../features/auth/useAuth.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { AdminDashboardPage } from "../features/dashboard/AdminDashboardPage.jsx";
import { CategoriesPage } from "../features/catalog/CategoriesPage.jsx";
import { BrandsPage } from "../features/catalog/BrandsPage.jsx";
import { ProductsPage } from "../features/catalog/ProductsPage.jsx";
import { VariationsPage } from "../features/catalog/VariationsPage.jsx";
import { SalesPage } from "../features/sales/NfceSalesPage.jsx";
import { StockMovementsPage } from "../features/stock/StockMovementsPage.jsx";
import { ReportsPage } from "../features/reports/ReportsPage.jsx";
import { AppShell } from "../shared/components/AppShell.jsx";
import { ToastProvider } from "../shared/components/ToastProvider.jsx";
import { ConfirmProvider } from "../shared/components/ConfirmProvider.jsx";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

/** Layout + página numa única árvore — evita Outlet aninhado (tela branca em /vendas). */
function PrivateShell({ children }) {
  return (
    <PrivateRoute>
      <AppShell>{children}</AppShell>
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
      <Route path="/catalog/variations" element={<PrivateShell><VariationsPage /></PrivateShell>} />
      <Route path="/sales" element={<Navigate to="/vendas" replace />} />
      <Route path="/stock" element={<Navigate to="/estoque/movimentos" replace />} />
      <Route path="/reports" element={<Navigate to="/relatorios" replace />} />
      <Route path="/vendas" element={<PrivateShell><SalesPage /></PrivateShell>} />
      <Route path="/estoque/movimentos" element={<PrivateShell><StockMovementsPage /></PrivateShell>} />
      <Route path="/relatorios" element={<PrivateShell><ReportsPage /></PrivateShell>} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AppRoutes />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
