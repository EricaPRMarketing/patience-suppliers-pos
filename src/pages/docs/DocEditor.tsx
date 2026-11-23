import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Customer, type Product, type SalesDoc } from '../../db/db';
import { useCurrentUser } from '../../auth/AuthContext';
import { can } from '../../auth/permissions';
import { formatNgwee } from '../../lib/format';
import { parseKwacha } from '../../lib/money';
import { lineTotal, type DocInput } from '../../lib/docs';
import { highlight, searchItems } from '../../lib/search';

const MAX_SHOWN = 50;

interface Row {
  productId: string;
  quantity: string;
  discount: string;
}

const EMPTY_CUSTOMER: Customer = { name: '', phone: '', email: '', address: '' };

/** Shared form for quotations, invoices and quick sales. Prices always come from inventory. */
export function DocEditor({
  initial,
  mode,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: SalesDoc;
  mode: 'quote' | 'invoice' | 'sale';
  submitLabel: string;
  onSubmit: (input: DocInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const user = useCurrentUser();
  const canDiscount = can(user.role, 'docs.discount');
  const products = useLiveQuery(() => db.products.filter((p) => p.active).toArray(), []);
  const pastCustomers = useLiveQuery(async () => {
    const docs = await db.docs.toArray();
    const map = new Map<string, Customer>();
    for (const d of docs) if (d.customer.name !== 'Cash customer') map.set(d.customer.name, d.customer);
    return [...map.values()];
  }, []);
  const [customer, setCustomer] = useState<Customer>(initial?.customer ?? EMPTY_CUSTOMER);
  const [rows, setRows] = useState<Row[]>(
    initial?.lines.map((l) => ({
      productId: l.productId,
      quantity: String(l.quantity),
      discount: l.discountNgwee ? (l.discountNgwee / 100).toFixed(2) : '',
    })) ?? [],
  );
  const [docDiscount, setDocDiscount] = useState(initial?.discountNgwee ? (initial.discountNgwee / 100).toFixed(2) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [dateLimit, setDateLimit] = useState(initial?.dateLimit ?? '');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const q = search.trim().toLowerCase();
  const allMatches = useMemo(() => (q ? searchItems(products ?? [], q) : []), [products, q]);
  const matches = allMatches.slice(0, MAX_SHOWN);

  const priced = rows.map((r) => {
    const p = byId.get(r.productId);
    const quantity = Number(r.quantity) || 0;
    const discountNgwee = parseKwacha(r.discount || '0') ?? 0;
    return { r, p, quantity, discountNgwee, total: p ? lineTotal({ quantity, unitPriceNgwee: p.priceNgwee, discountNgwee }) : 0 };
  });
  const subtotal = priced.reduce((s, x) => s + x.total, 0);
  const extra = parseKwacha(docDiscount || '0') ?? 0;
  const total = subtotal - extra;

  function add(p: Product) {
    setSearch('');
    setActive(0);
    setRows((rs) => {
      const i = rs.findIndex((r) => r.productId === p.id);
      if (i >= 0) return rs.map((r, j) => (j === i ? { ...r, quantity: String((Number(r.quantity) || 0) + 1) } : r));
      return [...rs, { productId: p.id, quantity: '1', discount: '' }];
    });
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    setError('');
    if (mode !== 'sale' && !customer.name.trim()) return setError('Enter the customer name.');
    setBusy(true);
    try {
      await onSubmit({
        customer,
        lines: priced.map((x) => ({ productId: x.r.productId, quantity: x.quantity, discountNgwee: x.discountNgwee })),
        discountNgwee: extra,
        notes,
        dateLimit: dateLimit || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <div className="doc-editor">
      {mode !== 'sale' && (
        <section className="card form-grid">
          <h2>Customer</h2>
          <label>
            Name or company
            <input
              value={customer.name}
              list="past-customers"
              onChange={(e) => {
                const found = pastCustomers?.find((c) => c.name === e.target.value);
                setCustomer(found ?? { ...customer, name: e.target.value });
              }}
              required
            />
            <datalist id="past-customers">
              {pastCustomers?.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
          </label>
          <label>
            Phone
            <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} inputMode="tel" />
          </label>
          <label>
            Email
            <input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} type="email" />
          </label>
          <label>
            Address
            <input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
          </label>
          <label>
            {mode === 'quote' ? 'Valid until' : 'Payment due'}
            <input type="date" value={dateLimit} onChange={(e) => setDateLimit(e.target.value)} />
          </label>
        </section>
      )}

      <section className="card">
        <h2>Items</h2>
        <div className="picker">
          <input
            placeholder="Start typing an item name or code, e.g. ce for cement"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && matches.length) {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, matches.length - 1));
              } else if (e.key === 'ArrowUp' && matches.length) {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter' && matches[active]) {
                e.preventDefault();
                add(matches[active]);
              } else if (e.key === 'Escape') setSearch('');
            }}
            autoFocus={mode === 'sale'}
            aria-label="Find item"
            role="combobox"
            aria-expanded={matches.length > 0}
            aria-controls="picker-results"
          />
          {matches.length > 0 && (
            <div className="picker-pop">
              <p className="picker-count">
                {allMatches.length} {allMatches.length === 1 ? 'item matches' : 'items match'}
                {allMatches.length > MAX_SHOWN && `, showing the first ${MAX_SHOWN}. Keep typing to narrow it down.`}
                <span className="picker-keys">↑ ↓ to move, Enter to add</span>
              </p>
              <ul className="picker-list" id="picker-results" role="listbox">
                {matches.map((p, i) => (
                  <li key={p.id} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      className={`ghost${i === active ? ' active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => add(p)}
                      ref={(el) => {
                        if (i === active && el) el.scrollIntoView({ block: 'nearest' });
                      }}
                    >
                      <span>
                        {highlight(p.name, q).map((part, k) => (part.hit ? <mark key={k}>{part.text}</mark> : <span key={k}>{part.text}</span>))}{' '}
                        <span className="muted">{p.code}</span>
                      </span>
                      <span className="nowrap">
                        {formatNgwee(p.priceNgwee)} · <span className={p.quantity === 0 ? 'down' : 'muted'}>{p.quantity} left</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {q && matches.length === 0 && <p className="muted">No item matches "{search}".</p>}
        </div>

        {rows.length > 0 && (
          <div className="table-wrap">
            <table className="lines">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit price</th>
                  {canDiscount && <th className="num">Discount (K)</th>}
                  <th className="num">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {priced.map(({ r, p, quantity, total: amount }, i) => (
                  <tr key={r.productId}>
                    <td>
                      {p?.name ?? 'Item removed from stock list'}
                      {p && mode !== 'quote' && quantity > p.quantity && (
                        <div className="down small">Only {p.quantity} {p.unit} in stock</div>
                      )}
                    </td>
                    <td className="num">
                      <input
                        className="qty-input"
                        type="number"
                        min={0}
                        step="any"
                        value={r.quantity}
                        onChange={(e) => update(i, { quantity: e.target.value })}
                        aria-label={`Quantity of ${p?.name}`}
                      />
                    </td>
                    <td className="num nowrap">{p ? formatNgwee(p.priceNgwee) : ''}</td>
                    {canDiscount && (
                      <td className="num">
                        <input
                          className="qty-input"
                          inputMode="decimal"
                          value={r.discount}
                          placeholder="0.00"
                          onChange={(e) => update(i, { discount: e.target.value })}
                          aria-label={`Discount on ${p?.name}`}
                        />
                      </td>
                    )}
                    <td className="num nowrap">{formatNgwee(amount)}</td>
                    <td className="num">
                      <button
                        type="button"
                        className="ghost icon-btn"
                        aria-label="Remove"
                        onClick={() => setRows(rows.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="totals">
          {canDiscount && (
            <label className="inline">
              Discount on whole {mode === 'quote' ? 'quotation' : 'invoice'} (K)
              <input className="qty-input" inputMode="decimal" value={docDiscount} placeholder="0.00" onChange={(e) => setDocDiscount(e.target.value)} />
            </label>
          )}
          <div className="grand">
            <span>Total</span>
            <strong>{formatNgwee(Math.max(total, 0))}</strong>
          </div>
          <p className="muted small">Prices in Zambian Kwacha. No VAT charged.</p>
        </div>

        {mode !== 'sale' && (
          <label>
            Notes for the customer
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional, e.g. delivery to site in Siavonga" />
          </label>
        )}
      </section>

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" onClick={submit} disabled={busy || rows.length === 0}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
