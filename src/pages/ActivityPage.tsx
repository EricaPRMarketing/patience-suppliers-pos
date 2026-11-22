import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useCurrentUser } from '../auth/AuthContext';
import { canSeeActivityOf, ROLE_LABEL } from '../auth/permissions';
import { formatDateTime } from '../lib/format';

export function ActivityPage() {
  const user = useCurrentUser();
  const [who, setWho] = useState('');
  const [search, setSearch] = useState('');
  const entries = useLiveQuery(
    async () => (await db.activity.orderBy('at').reverse().toArray()).filter((a) => canSeeActivityOf(user, a)),
    [user.id],
  );
  const people = useMemo(() => [...new Set(entries?.map((e) => e.username))].sort(), [entries]);
  const shown = entries?.filter(
    (e) =>
      (!who || e.username === who) &&
      (!search || `${e.action} ${e.details}`.toLowerCase().includes(search.toLowerCase())),
  );
  const scope =
    user.role === 'owner'
      ? 'everyone, including managers and staff'
      : user.role === 'manager'
        ? 'you and all staff'
        : 'your own account';

  return (
    <>
      <h1>Activity log</h1>
      <p className="muted">Showing activity for {scope}.</p>
      <div className="filters">
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter by person">
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <input placeholder="Search actions" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Role</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {shown?.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{formatDateTime(e.at)}</td>
                  <td>{e.username}</td>
                  <td>
                    <span className={`role role-${e.role}`}>{ROLE_LABEL[e.role]}</span>
                  </td>
                  <td>{e.action}</td>
                  <td className="muted">{e.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown?.length === 0 && <p className="muted">No activity matches.</p>}
        </div>
      </section>
    </>
  );
}
