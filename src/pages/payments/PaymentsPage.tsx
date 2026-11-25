import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCurrentUser } from '../../auth/AuthContext';
import { can } from '../../auth/permissions';
import { formatDateTime, formatNgwee } from '../../lib/format';
import {
  allPayments,
  EMPTY_ACCOUNTS,
  getPaymentAccounts,
  METHOD_LABEL,
  reviewPayment,
  savePaymentAccounts,
  usableAccounts,
  type PaymentAccounts,
  type PaymentRow,
} from '../../lib/payments';
import { Modal } from '../../components/Modal';
import { PayStatus, ProofLink } from '../docs/DocPages';

export function PaymentsPage() {
  const user = useCurrentUser();
  const rows = useLiveQuery(allPayments, []);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');
  const [reviewing, setReviewing] = useState<{ row: PaymentRow; approve: boolean } | null>(null);
  const pending = (rows ?? []).filter((r) => r.payment.status === 'pending');
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = (rows ?? []).filter((r) => r.payment.status === 'confirmed' && r.payment.at.slice(0, 10) === today);
  const sum = (method: string) => todayRows.filter((r) => r.payment.method === method).reduce((s, r) => s + r.payment.amountNgwee, 0);
  const shown = (rows ?? []).filter((r) => filter === 'all' || r.payment.status === filter);

  return (
    <>
      <h1>Payments</h1>
      <div className="tiles">
        <div className="tile">
          <span>Waiting for a check</span>
          <strong className={pending.length ? 'warn-text' : ''}>{pending.length}</strong>
        </div>
        <div className="tile">
          <span>Cash today</span>
          <strong>{formatNgwee(sum('cash'))}</strong>
        </div>
        <div className="tile">
          <span>Mobile money today</span>
          <strong>{formatNgwee(sum('mobile_money'))}</strong>
        </div>
        <div className="tile">
          <span>Bank today</span>
          <strong>{formatNgwee(sum('bank'))}</strong>
        </div>
      </div>

      <section className={`card${pending.length ? ' alert-card' : ''}`}>
        <h2>Check mobile money and bank payments ({pending.length})</h2>
        <p className="muted">
          Open the company's mobile money or bank statement and find each transaction ID before confirming. Nobody can confirm a payment they
          recorded themselves, except the owner.
        </p>
        {pending.length === 0 ? (
          <p className="muted">Nothing is waiting.</p>
        ) : (
          <ul className="review-list">
            {pending.map((r) => (
              <li key={r.payment.id} className="review-item">
                <div>
                  <strong className="big">{formatNgwee(r.payment.amountNgwee)}</strong>{' '}
                  <span className="chip">{METHOD_LABEL[r.payment.method]}</span>
                  <dl className="review-facts">
                    <dt>{r.payment.method === 'bank' ? 'Bank' : 'Network'}</dt>
                    <dd>{r.payment.channel}</dd>
                    <dt>{r.payment.method === 'bank' ? 'Reference' : 'Transaction ID'}</dt>
                    <dd className="mono">{r.payment.reference}</dd>
                    {r.payment.payer && (
                      <>
                        <dt>Paid from</dt>
                        <dd>{r.payment.payer}</dd>
                      </>
                    )}
                    <dt>For</dt>
                    <dd>
                      <Link to={`/invoices/${r.doc.id}`}>{r.doc.number}</Link> · {r.doc.customer.name}
                    </dd>
                    <dt>Recorded</dt>
                    <dd>
                      {formatDateTime(r.payment.at)} by {r.payment.username}
                    </dd>
                  </dl>
                </div>
                <div className="review-actions">
                  {r.payment.popFileId && <ProofLink id={r.payment.popFileId} />}
                  <button onClick={() => setReviewing({ row: r, approve: true })}>Money received: confirm</button>
                  <button className="ghost danger" onClick={() => setReviewing({ row: r, approve: false })}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>All payments</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Show">
            <option value="all">All</option>
            <option value="pending">Waiting for a check</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Method</th>
                <th>Reference</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 200).map((r) => (
                <tr key={r.payment.id}>
                  <td className="nowrap">{formatDateTime(r.payment.at)}</td>
                  <td>
                    <Link to={`/invoices/${r.doc.id}`}>{r.doc.number}</Link>
                  </td>
                  <td>{r.doc.customer.name}</td>
                  <td>
                    {METHOD_LABEL[r.payment.method]}
                    {r.payment.channel && <span className="muted small block">{r.payment.channel}</span>}
                  </td>
                  <td className="mono">{r.payment.method === 'cash' ? '' : r.payment.reference}</td>
                  <td className="num nowrap">{formatNgwee(r.payment.amountNgwee)}</td>
                  <td>
                    <PayStatus status={r.payment.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && <p className="muted">No payments yet.</p>}
      </section>

      <AccountsCard canEdit={can(user.role, 'settings.edit')} />

      {reviewing && <ReviewDialog {...reviewing} onClose={() => setReviewing(null)} />}
    </>
  );
}

function ReviewDialog({ row, approve, onClose }: { row: PaymentRow; approve: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const p = row.payment;
  return (
    <Modal title={approve ? 'Confirm payment' : 'Reject payment'} onClose={onClose}>
      <div className="form-grid">
        <p className="span-all">
          {approve
            ? `Only confirm if ${formatNgwee(p.amountNgwee)} with reference ${p.reference} is on the ${p.channel} statement. ${row.doc.number} will then count as paid.`
            : `The payment is marked rejected and ${row.doc.number} stays unpaid. The owner is alerted.`}
        </p>
        <label className="span-all">
          {approve ? 'Note (optional)' : 'Reason'}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={approve ? 'e.g. Seen on MTN statement' : 'e.g. Reference not on the statement'} autoFocus />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="ghost" onClick={onClose}>
            Back
          </button>
          <button
            className={approve ? '' : 'danger-solid'}
            onClick={async () => {
              try {
                await reviewPayment(user, row.doc.id, p.id, approve, note);
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not save.');
              }
            }}
          >
            {approve ? 'Confirm payment' : 'Reject payment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Where customers send money. Everyone sees it; only the owner can change it. */
function AccountsCard({ canEdit }: { canEdit: boolean }) {
  const user = useCurrentUser();
  const saved = useLiveQuery(getPaymentAccounts, []);
  const [form, setForm] = useState<PaymentAccounts | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (saved && !form) setForm(structuredClone(saved));
  }, [saved, form]);
  if (!saved || !form) return null;
  const usable = usableAccounts(saved);

  if (!canEdit)
    return (
      <section className="card">
        <h2>Where customers pay</h2>
        {usable.mobileMoney.length + usable.bank.length === 0 && <p className="muted">The owner has not added the company's payment details yet.</p>}
        <ul className="low-list">
          {usable.mobileMoney.map((m) => (
            <li key={m.network}>
              <span>{m.network}</span>
              <strong>
                {m.number} · {m.accountName}
              </strong>
            </li>
          ))}
          {usable.bank.map((b) => (
            <li key={b.bank + b.accountNumber}>
              <span>{b.bank}</span>
              <strong>
                {b.accountNumber} · {b.accountName}
              </strong>
            </li>
          ))}
        </ul>
      </section>
    );

  const setMm = (i: number, k: 'number' | 'accountName', v: string) =>
    setForm({ ...form, mobileMoney: form.mobileMoney.map((m, j) => (j === i ? { ...m, [k]: v } : m)) });
  const setBank = (i: number, k: keyof PaymentAccounts['bank'][number], v: string) =>
    setForm({ ...form, bank: form.bank.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });

  return (
    <section className="card">
      <h2>Where customers pay (owner only)</h2>
      <p className="muted">
        Staff show these to customers paying by mobile money or bank. Leave a number empty to hide that option. Every change is recorded and
        shows as a security alert, because changing a number is an easy way to divert money.
      </p>
      <h3>Mobile money</h3>
      <div className="acc-grid">
        {form.mobileMoney.map((m, i) => (
          <fieldset key={m.network} className="acc">
            <legend>{m.network}</legend>
            <label>
              Number
              <input value={m.number} onChange={(e) => setMm(i, 'number', e.target.value)} inputMode="tel" placeholder="e.g. 096 123 4567" />
            </label>
            <label>
              Name on the account
              <input value={m.accountName} onChange={(e) => setMm(i, 'accountName', e.target.value)} />
            </label>
          </fieldset>
        ))}
      </div>
      <h3>Bank accounts</h3>
      <div className="acc-grid">
        {form.bank.map((b, i) => (
          <fieldset key={i} className="acc">
            <legend>Bank account {form.bank.length > 1 ? i + 1 : ''}</legend>
            <label>
              Bank
              <input value={b.bank} onChange={(e) => setBank(i, 'bank', e.target.value)} placeholder="e.g. Zanaco" />
            </label>
            <label>
              Branch
              <input value={b.branch} onChange={(e) => setBank(i, 'branch', e.target.value)} placeholder="e.g. Siavonga" />
            </label>
            <label>
              Account name
              <input value={b.accountName} onChange={(e) => setBank(i, 'accountName', e.target.value)} />
            </label>
            <label>
              Account number
              <input value={b.accountNumber} onChange={(e) => setBank(i, 'accountNumber', e.target.value)} inputMode="numeric" />
            </label>
            <label>
              Branch code
              <input value={b.branchCode} onChange={(e) => setBank(i, 'branchCode', e.target.value)} />
            </label>
            <label>
              SWIFT code
              <input value={b.swift} onChange={(e) => setBank(i, 'swift', e.target.value)} />
            </label>
          </fieldset>
        ))}
      </div>
      <button
        type="button"
        className="ghost small-btn"
        onClick={() => setForm({ ...form, bank: [...form.bank, { ...EMPTY_ACCOUNTS.bank[0] }] })}
      >
        + Add another bank account
      </button>
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button
          type="button"
          onClick={async () => {
            setError('');
            try {
              await savePaymentAccounts(user, form);
              setMessage('Saved. Staff now show these details to customers.');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not save.');
            }
          }}
        >
          Save payment details
        </button>
      </div>
    </section>
  );
}
