import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useCurrentUser } from '../auth/AuthContext';
import { computeAlerts, markReviewed, reviewedAlertIds, RULES, type Alert } from '../lib/alerts';
import { logActivity, verifyActivityLog, type LogCheck } from '../lib/activity';
import { formatDateTime, formatNgwee } from '../lib/format';
import { Icon } from '../components/Icon';

export function useAlerts() {
  // Re-run the checks whenever the log, stock or settings change.
  const stamp = useLiveQuery(async () => {
    const [a, m, p, s, d] = await Promise.all([
      db.activity.count(),
      db.stockMovements.count(),
      db.products.toArray(),
      db.settings.toArray(),
      db.docs.count(),
    ]);
    return `${a}|${m}|${d}|${p.map((x) => x.updatedAt + x.quantity).join()}|${s.map((x) => x.value).join()}`;
  });
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const refresh = useCallback(async () => {
    const [a, r] = await Promise.all([computeAlerts(), reviewedAlertIds()]);
    setAlerts(a);
    setReviewed(r);
  }, []);
  useEffect(() => {
    if (stamp !== undefined) refresh();
  }, [stamp, refresh]);
  return { alerts, reviewed, refresh };
}

export function SecurityPage() {
  const user = useCurrentUser();
  const { alerts, reviewed, refresh } = useAlerts();
  const [log, setLog] = useState<LogCheck | null>(null);
  const [showReviewed, setShowReviewed] = useState(false);

  useEffect(() => {
    verifyActivityLog().then(setLog);
  }, [alerts]);

  const open = alerts?.filter((a) => !reviewed.has(a.id)) ?? [];
  const shown = showReviewed ? (alerts ?? []) : open;

  async function review(a: Alert[]) {
    await markReviewed(a.map((x) => x.id));
    await logActivity(user, 'Alerts reviewed', a.length === 1 ? a[0].title : `${a.length} alerts`);
    refresh();
  }

  return (
    <>
      <div className="page-head">
        <h1>Security</h1>
        {open.length > 1 && (
          <button className="ghost" onClick={() => review(open)}>
            Mark all {open.length} as reviewed
          </button>
        )}
      </div>
      <p className="muted">Only the owner can see this page. It checks the activity log and stock records for signs of theft or cover-ups.</p>

      <div className={`card log-status ${log?.ok === false ? 'bad' : 'good'}`}>
        <Icon name={log?.ok === false ? 'alert' : 'shield'} size={28} />
        <div>
          <strong>
            {log === null
              ? 'Checking the activity log…'
              : log.ok
                ? `Activity log intact: all ${log.checked} entries check out`
                : `Activity log tampered with: ${log.problems.length} problem${log.problems.length > 1 ? 's' : ''} found`}
          </strong>
          <p className="muted small">
            Every entry is sealed with a code that depends on the entry before it, so changing or deleting any record is
            detected here.
          </p>
        </div>
      </div>

      <div className="filters">
        <span className={open.length ? 'pill warn' : 'pill ok'}>
          {open.length ? `${open.length} alert${open.length > 1 ? 's' : ''} to review` : 'No open alerts'}
        </span>
        <label className="check">
          <input type="checkbox" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} /> Show
          reviewed alerts
        </label>
      </div>

      <div className="alert-list">
        {shown.map((a) => (
          <div key={a.id} className={`card alert-item ${a.severity} ${reviewed.has(a.id) ? 'reviewed' : ''}`}>
            <div className="alert-sev">{a.severity === 'high' ? 'High' : 'Check'}</div>
            <div className="alert-body">
              <strong>{a.title}</strong>
              <p>{a.details}</p>
              <span className="muted small">{formatDateTime(a.at)}</span>
            </div>
            {!reviewed.has(a.id) && (
              <button className="ghost" onClick={() => review([a])}>
                Reviewed
              </button>
            )}
          </div>
        ))}
        {alerts && shown.length === 0 && <p className="muted">Nothing unusual found.</p>}
      </div>

      <section className="card">
        <h2>What is checked</h2>
        <ul className="feature-list">
          <li>Edited, deleted or missing activity log entries</li>
          <li>Stock quantities changed outside the app, so they no longer match the item's history</li>
          <li>Accounts locked after 5 wrong passwords, and sign-in attempts on locked or deactivated accounts</li>
          <li>
            Stock removed in one go worth {formatNgwee(RULES.largeRemovalNgwee)} or more, or half of an item's stock
          </li>
          <li>{RULES.writeOffsPerDay} or more stock removals by one person in a day</li>
          <li>Stock uploads that lower quantities</li>
          <li>Voided invoices, especially ones that had already been paid</li>
          <li>Discounts of {RULES.discountShare * 100}% or more on a quotation, invoice or sale</li>
          <li>Missing quotation or invoice numbers (deleted documents)</li>
          <li>Price cuts of {RULES.priceDropShare * 100}% or more, and prices lowered then put back within {RULES.priceRestoreHours} hours</li>
          <li>
            Staff or manager activity before {RULES.openHour}:00, after {RULES.closeHour}:00 or on Sundays
          </li>
        </ul>
      </section>
    </>
  );
}
