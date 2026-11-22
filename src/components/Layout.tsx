import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { can, ROLE_LABEL, type Permission } from '../auth/permissions';
import { useOnline } from '../lib/useOnline';

const NAV: { to: string; label: string; needs?: Permission }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/sales', label: 'Sales', needs: 'sales.create' },
  { to: '/quotations', label: 'Quotations', needs: 'quotes.create' },
  { to: '/invoices', label: 'Invoices', needs: 'invoices.create' },
  { to: '/inventory', label: 'Inventory', needs: 'inventory.view' },
  { to: '/payments', label: 'Payments', needs: 'payments.confirm' },
  { to: '/users', label: 'Users', needs: 'users.view' },
  { to: '/activity', label: 'Activity log' },
  { to: '/account', label: 'My account' },
];

export function Layout() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const online = useOnline();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icon.svg" alt="" width={32} height={32} />
          <div>
            <strong>Patience Suppliers</strong>
            <span>Point of sale</span>
          </div>
        </div>
        <nav>
          {NAV.filter((n) => !n.needs || can(user.role, n.needs)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className={online ? 'pill ok' : 'pill warn'} role="status">
            {online ? 'Online' : 'Offline: work is saved on this device'}
          </span>
          <span className="who">
            {user.fullName} · <span className={`role role-${user.role}`}>{ROLE_LABEL[user.role]}</span>
          </span>
          <button className="ghost" onClick={() => logout()}>
            Sign out
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
