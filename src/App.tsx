import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ROUTER_MODE } from './lib/paths';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { can, type Permission } from './auth/permissions';
import { hasOwner } from './lib/users';
import { Layout } from './components/Layout';
import { SetupPage } from './pages/SetupPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { ActivityPage } from './pages/ActivityPage';
import { AccountPage } from './pages/AccountPage';
import { PaymentsPage } from './pages/payments/PaymentsPage';
import { SecurityPage } from './pages/SecurityPage';
import { DocList, DocViewPage, EditQuotePage, NewDocPage, SalesPage } from './pages/docs/DocPages';
import { PrintPage } from './pages/docs/PrintPage';
import { InventoryPage } from './pages/inventory/InventoryPage';

function Guard({ needs, children }: { needs?: Permission; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (needs && !can(user.role, needs)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const [ownerExists, setOwnerExists] = useState<boolean | null>(null);

  useEffect(() => {
    hasOwner().then(setOwnerExists);
  }, []);

  if (loading || ownerExists === null) return <div className="auth-page muted">Loading…</div>;
  if (!ownerExists) return <SetupPage onDone={() => setOwnerExists(true)} />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="sales" element={<Guard needs="sales.create"><SalesPage /></Guard>} />
        <Route path="quotations" element={<Guard needs="quotes.create"><DocList kind="quote" /></Guard>} />
        <Route path="quotations/new" element={<Guard needs="quotes.create"><NewDocPage kind="quote" /></Guard>} />
        <Route path="quotations/:id" element={<Guard needs="quotes.create"><DocViewPage /></Guard>} />
        <Route path="quotations/:id/edit" element={<Guard needs="quotes.create"><EditQuotePage /></Guard>} />
        <Route path="invoices" element={<Guard needs="invoices.create"><DocList kind="invoice" /></Guard>} />
        <Route path="invoices/new" element={<Guard needs="invoices.create"><NewDocPage kind="invoice" /></Guard>} />
        <Route path="invoices/:id" element={<Guard needs="invoices.create"><DocViewPage /></Guard>} />
        <Route path="inventory" element={<Guard needs="inventory.view"><InventoryPage /></Guard>} />
        <Route path="payments" element={<Guard needs="payments.confirm"><PaymentsPage /></Guard>} />
        <Route path="users" element={<Guard needs="users.view"><UsersPage /></Guard>} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="security" element={<Guard needs="security.view"><SecurityPage /></Guard>} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      <Route path="/print/:id" element={<Guard><PrintPage /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const Router = ROUTER_MODE === 'memory' ? MemoryRouter : BrowserRouter;
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
