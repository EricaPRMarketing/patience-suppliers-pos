import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { can, ROLE_LABEL, type Permission } from '../auth/permissions';
import { useOnline } from '../lib/useOnline';
import { Icon } from './Icon';

const NAV: { to: string; label: string; icon: string; needs?: Permission }[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/sales', label: 'Sales', icon: 'sales', needs: 'sales.create' },
  { to: '/quotations', label: 'Quotations', icon: 'quotations', needs: 'quotes.create' },
  { to: '/invoices', label: 'Invoices', icon: 'invoices', needs: 'invoices.create' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory', needs: 'inventory.view' },
  { to: '/payments', label: 'Payments', icon: 'payments', needs: 'payments.confirm' },
  { to: '/users', label: 'Users', icon: 'users', needs: 'users.view' },
  { to: '/activity', label: 'Activity log', icon: 'activity' },
  { to: '/security', label: 'Security', icon: 'shield', needs: 'security.view' },
  { to: '/account', label: 'My account', icon: 'account' },
];

export function Layout() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const online = useOnline();
  const location = useLocation();
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
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className="tab">
              <Icon name={n.icon} />
              <span>{n.label}</span>
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
            <Icon name="signout" size={18} />
            Sign out
          </button>
        </header>
        <main className="content" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
