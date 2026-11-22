import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
import { ComingSoonPage } from './pages/ComingSoonPage';

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
        <Route path="sales" element={<Guard needs="sales.create"><ComingSoonPage title="Sales" step="step 3" icon="sales" features={["Quick till screen to sell from stock", "Works offline and syncs later", "Prints or shares a receipt"]} /></Guard>} />
        <Route path="quotations" element={<Guard needs="quotes.create"><ComingSoonPage title="Quotations" step="step 3" icon="quotations" features={["Build a quote from inventory items", "PDF on the Patience Suppliers letterhead", "Turn a quote into an invoice in one click"]} /></Guard>} />
        <Route path="invoices" element={<Guard needs="invoices.create"><ComingSoonPage title="Invoices" step="step 3" icon="invoices" features={["Kwacha invoices, no VAT", "Stock goes down when an invoice is issued", "Shows paid, part paid or unpaid"]} /></Guard>} />
        <Route path="inventory" element={<Guard needs="inventory.view"><ComingSoonPage title="Inventory" step="step 2" icon="inventory" features={["Upload stock from Excel or CSV", "Search, edit prices and quantities", "Low-stock warnings"]} /></Guard>} />
        <Route path="payments" element={<Guard needs="payments.confirm"><ComingSoonPage title="Payments" step="step 4" icon="payments" features={["Mobile money or bank with proof of payment upload", "Manager or owner confirms each payment", "Online payment gateway"]} /></Guard>} />
        <Route path="users" element={<Guard needs="users.view"><UsersPage /></Guard>} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
