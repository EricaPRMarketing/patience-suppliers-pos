import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { useCurrentUser } from '../auth/AuthContext';
import { can, canSeeActivityOf, ROLE_LABEL } from '../auth/permissions';
import { Hero } from '../components/Hero';
import { Icon } from '../components/Icon';
import { formatDateTime } from '../lib/format';
import { isLowStock } from '../lib/inventory';
import { useAlerts } from './SecurityPage';

export function DashboardPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const recent = useLiveQuery(
    async () =>
      (await db.activity.orderBy('at').reverse().limit(200).toArray())
        .filter((a) => canSeeActivityOf(user, a))
        .slice(0, 8),
    [user.id],
  );
  const { alerts, reviewed } = useAlerts();
  const openAlerts = user.role === 'owner' ? (alerts ?? []).filter((a) => !reviewed.has(a.id)) : [];
  const lowStock = useLiveQuery(async () => (await db.products.filter((p) => p.active).toArray()).filter(isLowStock));
  const counts = useLiveQuery(async () => {
    const users = await db.users.toArray();
    return {
      managers: users.filter((u) => u.role === 'manager' && u.active).length,
      staff: users.filter((u) => u.role === 'staff' && u.active).length,
      pendingSync: (await db.activity.where('syncState').equals('pending').count()),
    };
  });

  return (
    <>
      <Hero greeting={`${hello}, ${user.fullName.split(' ')[0]}`} canOpen={can(user.role, 'inventory.view')}>
        {can(user.role, 'sales.create') && (
          <button className="hero-btn" onClick={() => navigate('/sales')}>
            <Icon name="sales" size={18} /> New sale
          </button>
        )}
        {can(user.role, 'quotes.create') && (
          <button className="hero-btn alt" onClick={() => navigate('/quotations/new')}>
            <Icon name="plus" size={18} /> Quotation
          </button>
        )}
        {can(user.role, 'invoices.create') && (
          <button className="hero-btn alt" onClick={() => navigate('/invoices/new')}>
            <Icon name="plus" size={18} /> Invoice
          </button>
        )}
      </Hero>
      <p className="muted">Signed in as {ROLE_LABEL[user.role].toLowerCase()}. Tap a sticker to jump to that part of the stock list.</p>
      {user.role !== 'staff' && counts && (
        <div className="tiles">
          <div className="tile">
            <span>Active managers</span>
            <strong>{counts.managers}</strong>
          </div>
          <div className="tile">
            <span>Active staff</span>
            <strong>{counts.staff}</strong>
          </div>
          <div className="tile">
            <span>Records waiting to sync</span>
            <strong>{counts.pendingSync}</strong>
          </div>
        </div>
      )}
      {openAlerts.length > 0 && (
        <section className="card alert-card danger-card">
          <div className="row-between">
            <h2>Security alerts ({openAlerts.length})</h2>
            <Link to="/security">Review</Link>
          </div>
          <ul className="low-list">
            {openAlerts.slice(0, 4).map((a) => (
              <li key={a.id}>
                <span>{a.title}</span>
                <span className={a.severity === 'high' ? 'qty out' : 'qty low'}>{a.severity === 'high' ? 'High' : 'Check'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {lowStock && lowStock.length > 0 && (
        <section className="card alert-card">
          <div className="row-between">
            <h2>Low or out of stock ({lowStock.length})</h2>
            <Link to="/inventory">Open inventory</Link>
          </div>
          <ul className="low-list">
            {lowStock.slice(0, 6).map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <span className={p.quantity === 0 ? 'qty out' : 'qty low'}>
                  {p.quantity} {p.unit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card">
        <div className="row-between">
          <h2>Recent activity</h2>
          <Link to="/activity">See all</Link>
        </div>
        <ul className="activity-list">
          {recent?.map((a) => (
            <li key={a.id}>
              <span className="when">{formatDateTime(a.at)}</span>
              <span>
                <strong>{a.username}</strong> {a.action.toLowerCase()}
                {a.details && <span className="muted"> · {a.details}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
