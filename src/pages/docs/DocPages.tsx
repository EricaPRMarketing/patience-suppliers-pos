import { pageUrl, USE_HASH } from '../../lib/paths';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SalesDoc } from '../../db/db';
import { useCurrentUser } from '../../auth/AuthContext';
import { can } from '../../auth/permissions';
import { formatDateTime, formatNgwee } from '../../lib/format';
import { parseKwacha } from '../../lib/money';
import {
  convertQuote,
  createInvoice,
  createQuote,
  isExpired,
  lineTotal,
  paidNgwee,
  paymentState,
  recordCashPayment,
  setQuoteStatus,
  updateQuote,
  voidInvoice,
} from '../../lib/docs';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { DocEditor } from './DocEditor';

const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' });

export function StatusChip({ doc }: { doc: SalesDoc }) {
  if (doc.kind === 'quote') {
    if (isExpired(doc)) return <span className="status s-expired">Expired</span>;
    const label = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', converted: 'Invoiced', cancelled: 'Cancelled' }[
      doc.status as 'draft'
    ];
    return <span className={`status s-${doc.status}`}>{label}</span>;
  }
  const st = paymentState(doc);
  const label = { paid: 'Paid', part: 'Part paid', unpaid: 'Unpaid', void: 'Void' }[st];
  return <span className={`status s-${st}`}>{label}</span>;
}

export function DocList({ kind }: { kind: 'quote' | 'invoice' }) {
  const docs = useLiveQuery(() => db.docs.where('kind').equals(kind).reverse().sortBy('createdAt'), [kind]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const q = search.trim().toLowerCase();
  const shown = (docs ?? []).filter((d) => {
    if (q && !d.number.toLowerCase().includes(q) && !d.customer.name.toLowerCase().includes(q)) return false;
    if (!filter) return true;
    if (kind === 'invoice') return paymentState(d) === filter;
    return filter === 'expired' ? isExpired(d) : d.status === filter && !isExpired(d);
  });
  const base = kind === 'quote' ? '/quotations' : '/invoices';
  const owed = kind === 'invoice' ? (docs ?? []).filter((d) => d.status !== 'void').reduce((s, d) => s + d.totalNgwee - paidNgwee(d), 0) : 0;

  return (
    <>
      <div className="page-head">
        <h1>{kind === 'quote' ? 'Quotations' : 'Invoices'}</h1>
        <Link to={`${base}/new`} className="button-link">
          <Icon name="plus" size={18} /> New {kind === 'quote' ? 'quotation' : 'invoice'}
        </Link>
      </div>
      {kind === 'invoice' && (
        <div className="tiles">
          <div className="tile">
            <span>Invoices</span>
            <strong>{docs?.length ?? 0}</strong>
          </div>
          <div className="tile">
            <span>Still owed by customers</span>
            <strong className={owed ? 'warn-text' : ''}>{formatNgwee(owed)}</strong>
          </div>
        </div>
      )}
      <div className="filters">
        <input placeholder="Search by number or customer" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Status">
          <option value="">All</option>
          {kind === 'quote' ? (
            <>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="converted">Invoiced</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </>
          ) : (
            <>
              <option value="unpaid">Unpaid</option>
              <option value="part">Part paid</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </>
          )}
        </select>
      </div>
      <section className="card">
        <div className="table-wrap">
          <table className="clickable">
            <thead>
              <tr>
                <th>Number</th>
                <th>Customer</th>
                <th>Date</th>
                <th>{kind === 'quote' ? 'Valid until' : 'Due'}</th>
                <th className="num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id}>
                  <td className="nowrap">
                    <Link to={`${base}/${d.id}`}>{d.number}</Link>
                  </td>
                  <td>{d.customer.name}</td>
                  <td className="nowrap muted">{formatDateTime(d.createdAt)}</td>
                  <td className="nowrap muted">{formatDate(d.dateLimit)}</td>
                  <td className="num nowrap">{formatNgwee(d.totalNgwee)}</td>
                  <td>
                    <StatusChip doc={d} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {docs && shown.length === 0 && (
            <p className="muted">{docs.length ? 'Nothing matches.' : `No ${kind === 'quote' ? 'quotations' : 'invoices'} yet.`}</p>
          )}
        </div>
      </section>
    </>
  );
}

export function NewDocPage({ kind }: { kind: 'quote' | 'invoice' }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  return (
    <>
      <h1>New {kind === 'quote' ? 'quotation' : 'invoice'}</h1>
      <DocEditor
        mode={kind}
        submitLabel={kind === 'quote' ? 'Save quotation' : 'Issue invoice'}
        onCancel={() => navigate(-1)}
        onSubmit={async (input) => {
          const d = kind === 'quote' ? await createQuote(user, input) : await createInvoice(user, input);
          navigate(`/${kind === 'quote' ? 'quotations' : 'invoices'}/${d.id}`, { replace: true });
        }}
      />
    </>
  );
}

export function EditQuotePage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const doc = useLiveQuery(() => db.docs.get(id), [id]);
  if (doc === undefined) return null;
  return (
    <>
      <h1>Edit {doc.number}</h1>
      <DocEditor
        initial={doc}
        mode="quote"
        submitLabel="Save changes"
        onCancel={() => navigate(-1)}
        onSubmit={async (input) => {
          await updateQuote(user, id, input);
          navigate(`/quotations/${id}`, { replace: true });
        }}
      />
    </>
  );
}

export function DocViewPage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const doc = useLiveQuery(() => db.docs.get(id), [id]);
  const linked = useLiveQuery(async () => {
    const d = await db.docs.get(id);
    const other = d?.fromQuoteId ?? d?.convertedToId;
    return other ? db.docs.get(other) : undefined;
  }, [id]);
  const [dialog, setDialog] = useState<'pay' | 'void' | null>(null);
  const [error, setError] = useState('');

  if (doc === undefined) return null;
  const isQuote = doc.kind === 'quote';
  const open = isQuote && (doc.status === 'draft' || doc.status === 'sent' || doc.status === 'accepted');
  const owed = doc.totalNgwee - paidNgwee(doc);

  async function run(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            {isQuote ? 'Quotation' : doc.isCashSale ? 'Cash sale' : 'Invoice'} {doc.number}
          </h1>
          <StatusChip doc={doc} />
        </div>
        <div className="head-actions">
          <button
            className="ghost"
            onClick={() => (USE_HASH ? navigate(`/print/${doc.id}`) : window.open(pageUrl(`/print/${doc.id}`), '_blank'))}
          >
            <Icon name="print" size={18} /> Print or save PDF
          </button>
          {isQuote && (doc.status === 'draft' || doc.status === 'sent') && (
            <Link to={`/quotations/${doc.id}/edit`} className="button-link ghost">
              Edit
            </Link>
          )}
          {isQuote && doc.status === 'draft' && (
            <button className="ghost" onClick={() => run(() => setQuoteStatus(user, doc.id, 'sent'))}>
              Mark as sent
            </button>
          )}
          {isQuote && (doc.status === 'draft' || doc.status === 'sent') && (
            <button className="ghost" onClick={() => run(() => setQuoteStatus(user, doc.id, 'accepted'))}>
              Customer accepted
            </button>
          )}
          {open && (
            <button onClick={() => run(async () => navigate(`/invoices/${(await convertQuote(user, doc.id)).id}`))}>
              Turn into invoice
            </button>
          )}
          {!isQuote && doc.status !== 'void' && owed > 0 && <button onClick={() => setDialog('pay')}>Record cash payment</button>}
          {!isQuote && doc.status !== 'void' && can(user.role, 'docs.void') && (
            <button className="ghost danger" onClick={() => setDialog('void')}>
              Void invoice
            </button>
          )}
          {open && (
            <button className="ghost danger" onClick={() => run(() => setQuoteStatus(user, doc.id, 'cancelled'))}>
              Cancel quotation
            </button>
          )}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {doc.status === 'void' && <p className="notice danger-notice">Voided: {doc.voidReason}. The stock was put back.</p>}
      {linked && (
        <p className="muted">
          {isQuote ? 'Invoiced as ' : 'From quotation '}
          <Link to={`/${linked.kind === 'quote' ? 'quotations' : 'invoices'}/${linked.id}`}>{linked.number}</Link>
        </p>
      )}

      <div className="doc-grid">
        <section className="card">
          <h2>Customer</h2>
          <p className="customer">
            <strong>{doc.customer.name}</strong>
            {doc.customer.phone && <span>{doc.customer.phone}</span>}
            {doc.customer.email && <span>{doc.customer.email}</span>}
            {doc.customer.address && <span>{doc.customer.address}</span>}
          </p>
        </section>
        <section className="card">
          <h2>Details</h2>
          <dl className="facts">
            <dt>Date</dt>
            <dd>{formatDateTime(doc.createdAt)}</dd>
            <dt>{isQuote ? 'Valid until' : 'Payment due'}</dt>
            <dd>{formatDate(doc.dateLimit)}</dd>
            <dt>Prepared by</dt>
            <dd>{doc.createdByName}</dd>
          </dl>
        </section>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Unit price</th>
                <th className="num">Discount</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l) => (
                <tr key={l.productId}>
                  <td>
                    {l.name} <span className="muted small">{l.code}</span>
                  </td>
                  <td className="num nowrap">
                    {l.quantity} {l.unit}
                  </td>
                  <td className="num nowrap">{formatNgwee(l.unitPriceNgwee)}</td>
                  <td className="num nowrap muted">{l.discountNgwee ? `− ${formatNgwee(l.discountNgwee)}` : ''}</td>
                  <td className="num nowrap">{formatNgwee(lineTotal(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="totals">
          {doc.discountNgwee > 0 && (
            <div className="sub">
              <span>Discount</span>
              <span>− {formatNgwee(doc.discountNgwee)}</span>
            </div>
          )}
          <div className="grand">
            <span>Total</span>
            <strong>{formatNgwee(doc.totalNgwee)}</strong>
          </div>
          {!isQuote && doc.status !== 'void' && (
            <div className="sub">
              <span>Still owed</span>
              <strong className={owed > 0 ? 'warn-text' : 'up'}>{formatNgwee(owed)}</strong>
            </div>
          )}
        </div>
        {doc.notes && <p className="muted">Notes: {doc.notes}</p>}
      </section>

      {!isQuote && doc.payments.length > 0 && (
        <section className="card">
          <h2>Payments</h2>
          <ul className="low-list">
            {doc.payments.map((p) => (
              <li key={p.id}>
                <span>
                  {formatDateTime(p.at)} · {p.method === 'cash' ? 'Cash' : p.method} · received by {p.username}
                </span>
                <strong>{formatNgwee(p.amountNgwee)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialog === 'pay' && <PayDialog doc={doc} owed={owed} onClose={() => setDialog(null)} />}
      {dialog === 'void' && <VoidDialog doc={doc} onClose={() => setDialog(null)} />}
    </>
  );
}

function PayDialog({ doc, owed, onClose }: { doc: SalesDoc; owed: number; onClose: () => void }) {
  const user = useCurrentUser();
  const [amount, setAmount] = useState((owed / 100).toFixed(2));
  const [error, setError] = useState('');
  return (
    <Modal title={`Cash payment for ${doc.number}`} onClose={onClose}>
      <div className="form-grid">
        <label>
          Amount received (K)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus />
        </label>
        <p className="muted span-all">Still owed: {formatNgwee(owed)}. Mobile money and bank payments with proof of payment come in the next step.</p>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            onClick={async () => {
              try {
                await recordCashPayment(user, doc.id, parseKwacha(amount) ?? NaN);
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not record the payment.');
              }
            }}
          >
            Record payment
          </button>
        </div>
      </div>
    </Modal>
  );
}

function VoidDialog({ doc, onClose }: { doc: SalesDoc; onClose: () => void }) {
  const user = useCurrentUser();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  return (
    <Modal title={`Void ${doc.number}`} onClose={onClose}>
      <div className="form-grid">
        <p className="span-all">
          Voiding cancels the invoice and puts its stock back. It stays in the list marked Void and the owner is alerted.
        </p>
        <label className="span-all">
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer cancelled the order" autoFocus />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="ghost" onClick={onClose}>
            Keep invoice
          </button>
          <button
            className="danger-solid"
            onClick={async () => {
              try {
                await voidInvoice(user, doc.id, reason);
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not void the invoice.');
              }
            }}
          >
            Void invoice
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function SalesPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [key, setKey] = useState(0);
  const [last, setLast] = useState<SalesDoc | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const todays = useLiveQuery(
    async () => (await db.docs.where('kind').equals('invoice').toArray()).filter((d) => d.isCashSale && d.status !== 'void' && d.createdAt.slice(0, 10) === today),
    [today],
  );
  return (
    <>
      <div className="page-head">
        <h1>Sales</h1>
        <div className="tile compact">
          <span>Cash sales today</span>
          <strong>
            {todays?.length ?? 0} · {formatNgwee((todays ?? []).reduce((s, d) => s + d.totalNgwee, 0))}
          </strong>
        </div>
      </div>
      {last && (
        <p className="notice">
          Sale {last.number} saved: {formatNgwee(last.totalNgwee)} paid in cash.{' '}
          {USE_HASH ? (
            <Link to={`/print/${last.id}`}>Print receipt</Link>
          ) : (
            <a href={pageUrl(`/print/${last.id}`)} target="_blank" rel="noreferrer">
              Print receipt
            </a>
          )}{' '}
          · <Link to={`/invoices/${last.id}`}>Open</Link>
        </p>
      )}
      <DocEditor
        key={key}
        mode="sale"
        submitLabel="Paid in cash: complete sale"
        onSubmit={async (input) => {
          const d = await createInvoice(user, input, { cashSale: true });
          setLast(d);
          setKey((k) => k + 1);
        }}
        onCancel={() => navigate('/')}
      />
    </>
  );
}
