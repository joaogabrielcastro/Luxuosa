import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "../features/auth/useAuth.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { AdminDashboardPage } from "../features/dashboard/AdminDashboardPage.jsx";
import { CategoriesPage } from "../features/catalog/CategoriesPage.jsx";
import { ProductsPage } from "../features/catalog/ProductsPage.jsx";
import { VariationsPage } from "../features/catalog/VariationsPage.jsx";
import { SalesPage } from "../features/sales/SalesPage.jsx";
import { CashRegisterPage } from "../features/cash/CashRegisterPage.jsx";
import { AppShell } from "../shared/components/AppShell.jsx";
import { ToastProvider } from "../shared/components/ToastProvider.jsx";
import { ConfirmProvider } from "../shared/components/ConfirmProvider.jsx";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <PrivateRoute>
            <AppShell />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<AdminDashboardPage />} />
        <Route path="/catalog/categories" element={<CategoriesPage />} />
        <Route path="/catalog/products" element={<ProductsPage />} />
        <Route path="/catalog/variations" element={<VariationsPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/cash-register" element={<CashRegisterPage />} />
      </Route>
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
