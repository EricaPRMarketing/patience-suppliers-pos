import { asset } from '../lib/paths';
import { useEffect, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const items = NAV.filter((n) => !n.needs || can(user.role, n.needs));
  const current = [...items].reverse().find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useStackedTables(mainRef);

  return (
    <div className={`shell${menuOpen ? ' menu-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <img src={asset("icon.svg")} alt="" width={32} height={32} />
          <div>
            <strong>Patience Suppliers</strong>
            <span>{current?.label ?? 'Point of sale'}</span>
          </div>
          <button
            type="button"
            className="ghost menu-btn"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className={`burger${menuOpen ? ' x' : ''}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav id="main-nav">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className="tab" onClick={() => setMenuOpen(false)}>
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
          <button className="ghost signout" onClick={() => logout()} aria-label="Sign out">
            <Icon name="signout" size={18} />
            <span className="btn-text">Sign out</span>
          </button>
        </header>
        <main className="content" key={location.pathname} ref={mainRef}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * On phones, tables are shown as stacked cards so no column is cut off.
 * Each cell gets its column heading as a label, kept up to date as pages change.
 */
function useStackedTables(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const label = () => {
      for (const table of root.querySelectorAll('table')) {
        const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '');
        for (const row of table.querySelectorAll('tbody tr'))
          [...row.children].forEach((td, i) => {
            const text = heads[i] ?? '';
            if (td.getAttribute('data-label') !== text) td.setAttribute('data-label', text);
          });
      }
    };
    label();
    const obs = new MutationObserver(label);
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  });
}
