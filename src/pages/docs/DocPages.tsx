import { pageUrl, USE_HASH } from '../../lib/paths';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SalesDoc } from '../../db/db';
import { useCurrentUser } from '../../auth/AuthContext';
import { can } from '../../auth/permissions';
import { formatDateTime, formatNgwee } from '../../lib/format';
import {
  convertQuote,
  createInvoice,
  createQuote,
  isExpired,
  lineTotal,
  paidNgwee,
  paymentState,
  setQuoteStatus,
  updateQuote,
  voidInvoice,
} from '../../lib/docs';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { DocEditor } from './DocEditor';
import { TakePayment } from '../payments/TakePayment';
import { METHOD_LABEL, openBalance, openFile } from '../../lib/payments';
import { searchItems } from '../../lib/search';

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
  const [message, setMessage] = useState('');

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
          {((!isQuote && doc.status !== 'void' && openBalance(doc) > 0) || open) && (
            <button onClick={() => setDialog('pay')}>
              <Icon name="payments" size={18} /> Take payment
            </button>
          )}
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
      {message && <p className="notice">{message}</p>}
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
          <ul className="pay-list">
            {doc.payments.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>{formatNgwee(p.amountNgwee)}</strong> {METHOD_LABEL[p.method]}
                  {p.channel && ` · ${p.channel}`}
                  {p.method !== 'cash' && p.reference && ` · ref ${p.reference}`}
                  <span className="muted small block">
                    {formatDateTime(p.at)} · recorded by {p.username}
                    {p.reviewedBy && ` · ${p.status === 'confirmed' ? 'confirmed' : 'rejected'} by ${p.reviewedBy}`}
                    {p.reviewNote && `: ${p.reviewNote}`}
                  </span>
                </span>
                <span className="pay-side">
                  {p.popFileId && <ProofLink id={p.popFileId} />}
                  <PayStatus status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialog === 'pay' && (
        <Modal title={`Take payment for ${doc.number}`} onClose={() => setDialog(null)} wide>
          <TakePayment
            doc={doc}
            onCancel={() => setDialog(null)}
            onDone={(inv, msg) => {
              setDialog(null);
              if (inv.id !== doc.id) navigate(`/invoices/${inv.id}`);
              setMessage(msg);
            }}
          />
        </Modal>
      )}
      {dialog === 'void' && <VoidDialog doc={doc} onClose={() => setDialog(null)} />}
    </>
  );
}

export function PayStatus({ status }: { status: 'confirmed' | 'pending' | 'rejected' }) {
  return (
    <span className={`chip pay-${status}`}>{status === 'confirmed' ? 'Confirmed' : status === 'pending' ? 'Waiting for check' : 'Rejected'}</span>
  );
}

/** Shows a proof of payment kept on this device. */
export function ProofLink({ id, label = 'View proof' }: { id: string; label?: string }) {
  const [file, setFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const [missing, setMissing] = useState(false);
  return (
    <>
      <button
        type="button"
        className="ghost small-btn"
        onClick={async () => {
          const f = await openFile(id);
          if (f) setFile(f);
          else setMissing(true);
        }}
      >
        {missing ? 'Proof not on this device' : label}
      </button>
      {file && (
        <Modal
          title="Proof of payment"
          wide
          onClose={() => {
            URL.revokeObjectURL(file.url);
            setFile(null);
          }}
        >
          {file.type.startsWith('image/') ? (
            <img className="proof-img" src={file.url} alt="Proof of payment" />
          ) : (
            <object className="proof-pdf" data={file.url} type={file.type} aria-label="Proof of payment">
              <p>This device cannot show the PDF here.</p>
            </object>
          )}
          <p className="muted small">{file.name}</p>
        </Modal>
      )}
    </>
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

type SalesTab = 'new' | 'link';

export function SalesPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const linkId = (location.state as { docId?: string } | null)?.docId;
  const [tab, setTab] = useState<SalesTab>(linkId ? 'link' : 'new');
  const [key, setKey] = useState(0);
  const [last, setLast] = useState<SalesDoc | null>(null);
  const [message, setMessage] = useState('');
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
      <div className="seg" role="tablist" aria-label="Sales">
        <button role="tab" aria-selected={tab === 'new'} className={tab === 'new' ? 'seg-btn active' : 'seg-btn ghost'} onClick={() => setTab('new')}>
          <Icon name="sales" size={18} /> New sale
        </button>
        <button role="tab" aria-selected={tab === 'link'} className={tab === 'link' ? 'seg-btn active' : 'seg-btn ghost'} onClick={() => setTab('link')}>
          <Icon name="invoices" size={18} /> Pay a quotation or invoice
        </button>
      </div>
      {message && <p className="notice">{message}</p>}
      {tab === 'new' ? (
        <>
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
          <p className="muted small">
            For a walk-in customer paying cash now. If the customer is paying by mobile money or bank, or already has a quotation, use{' '}
            <button type="button" className="link-btn" onClick={() => setTab('link')}>
              Pay a quotation or invoice
            </button>
            .
          </p>
          <DocEditor
            key={key}
            mode="sale"
            submitLabel="Paid in cash: complete sale"
            onSubmit={async (input) => {
              const d = await createInvoice(user, input, { cashSale: true });
              setLast(d);
              setMessage('');
              setKey((k) => k + 1);
            }}
            onCancel={() => navigate('/')}
          />
        </>
      ) : (
        <LinkDocPanel
          initialId={linkId}
          onPaid={(inv, msg) => {
            setMessage(msg);
            navigate(location.pathname, { replace: true, state: null });
            void inv;
          }}
        />
      )}
    </>
  );
}

/** Find an open quotation or an unpaid invoice, then take payment for it. */
function LinkDocPanel({ initialId, onPaid }: { initialId?: string; onPaid: (inv: SalesDoc, message: string) => void }) {
  const [search, setSearch] = useState('');
  const [chosenId, setChosenId] = useState<string | undefined>(initialId);
  const open = useLiveQuery(async () => {
    const docs = await db.docs.toArray();
    return docs
      .filter((d) =>
        d.kind === 'quote' ? ['draft', 'sent', 'accepted'].includes(d.status) : d.status !== 'void' && !d.isCashSale && openBalance(d) > 0,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);
  const chosen = useLiveQuery(() => (chosenId ? db.docs.get(chosenId) : undefined), [chosenId]);

  const matches = search.trim()
    ? searchItems(
        (open ?? []).map((d) => ({ d, name: d.customer.name, code: d.number })),
        search,
      ).map((x) => x.d)
    : (open ?? []);

  if (chosen)
    return (
      <div className="doc-grid">
        <section className="card">
          <div className="row-between">
            <h2>
              {chosen.kind === 'quote' ? 'Quotation' : 'Invoice'} {chosen.number}
            </h2>
            <button type="button" className="ghost small-btn" onClick={() => setChosenId(undefined)}>
              Choose another
            </button>
          </div>
          <p>
            <strong>{chosen.customer.name}</strong>
            {chosen.customer.phone && <span className="muted"> · {chosen.customer.phone}</span>}
          </p>
          <ul className="mini-lines">
            {chosen.lines.map((l) => (
              <li key={l.productId}>
                <span>
                  {l.quantity} {l.unit} {l.name}
                </span>
                <span>{formatNgwee(lineTotal(l))}</span>
              </li>
            ))}
          </ul>
          <div className="totals">
            <div className="grand">
              <span>Total</span>
              <strong>{formatNgwee(chosen.totalNgwee)}</strong>
            </div>
            {chosen.kind === 'invoice' && (
              <div className="sub">
                <span>Still to pay</span>
                <strong className="warn-text">{formatNgwee(openBalance(chosen))}</strong>
              </div>
            )}
          </div>
          {chosen.kind === 'quote' && (
            <p className="muted small">Taking payment turns this quotation into an invoice and takes the items out of stock.</p>
          )}
          {chosen.kind === 'quote' && isExpired(chosen) && <p className="warn-text small">This quotation has expired. Check the prices with the customer.</p>}
        </section>
        <section className="card">
          <h2>How is the customer paying?</h2>
          <TakePayment
            key={chosen.id + chosen.updatedAt}
            doc={chosen}
            onCancel={() => setChosenId(undefined)}
            onDone={(inv, msg) => {
              setChosenId(undefined);
              onPaid(inv, msg);
            }}
          />
        </section>
      </div>
    );

  return (
    <section className="card">
      <h2>Find the quotation or invoice</h2>
      <input
        className="wide-input"
        placeholder="Number or customer name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Find a quotation or invoice"
        autoFocus
      />
      {open && open.length === 0 && <p className="muted">There are no open quotations or unpaid invoices.</p>}
      <ul className="link-list">
        {matches.slice(0, 30).map((d) => (
          <li key={d.id}>
            <button type="button" className="ghost" onClick={() => setChosenId(d.id)}>
              <span>
                <strong>{d.number}</strong> <span className={`chip ${d.kind === 'quote' ? 'chip-quote' : 'chip-invoice'}`}>{d.kind === 'quote' ? 'Quotation' : 'Invoice'}</span>
                <span className="block">{d.customer.name}</span>
              </span>
              <span className="link-amount">
                {formatNgwee(d.kind === 'quote' ? d.totalNgwee : openBalance(d))}
                <span className="muted small block">{d.kind === 'quote' ? 'quoted' : 'still to pay'}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {search.trim() && matches.length === 0 && <p className="muted">Nothing open matches "{search}".</p>}
    </section>
  );
}
