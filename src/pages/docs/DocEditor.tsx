import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Customer, type Product, type SalesDoc } from '../../db/db';
import { useCurrentUser } from '../../auth/AuthContext';
import { can } from '../../auth/permissions';
import { formatNgwee } from '../../lib/format';
import { parseKwacha } from '../../lib/money';
import { lineTotal, type DocInput } from '../../lib/docs';

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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const q = search.trim().toLowerCase();
  const matches = q
    ? (products ?? []).filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)).slice(0, 8)
    : [];

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
            placeholder="Type an item name or code to add it"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && matches[0] && add(matches[0])}
            autoFocus={mode === 'sale'}
            aria-label="Find item"
          />
          {matches.length > 0 && (
            <ul className="picker-list">
              {matches.map((p) => (
                <li key={p.id}>
                  <button type="button" className="ghost" onClick={() => add(p)}>
                    <span>
                      {p.name} <span className="muted">{p.code}</span>
                    </span>
                    <span className="nowrap">
                      {formatNgwee(p.priceNgwee)} · <span className={p.quantity === 0 ? 'down' : 'muted'}>{p.quantity} left</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
