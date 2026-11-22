import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { useCurrentUser } from '../auth/AuthContext';
import { canSeeActivityOf, ROLE_LABEL } from '../auth/permissions';
import { formatDateTime } from '../lib/format';
import { isLowStock } from '../lib/inventory';

export function DashboardPage() {
  const user = useCurrentUser();
  const recent = useLiveQuery(
    async () =>
      (await db.activity.orderBy('at').reverse().limit(200).toArray())
        .filter((a) => canSeeActivityOf(user, a))
        .slice(0, 8),
    [user.id],
  );
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
      <h1>Welcome, {user.fullName.split(' ')[0]}</h1>
      <p className="muted">Signed in as {ROLE_LABEL[user.role].toLowerCase()}.</p>
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
