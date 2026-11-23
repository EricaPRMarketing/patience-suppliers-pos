import { asset } from '../../lib/paths';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { formatNgwee } from '../../lib/format';
import { lineTotal, paidNgwee } from '../../lib/docs';

const date = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-ZM', { day: 'numeric', month: 'long', year: 'numeric' });

/** A4 page on the Patience Suppliers letterhead. "Save as PDF" in the print dialog makes the PDF. */
export function PrintPage() {
  const { id = '' } = useParams();
  const doc = useLiveQuery(() => db.docs.get(id), [id]);

  useEffect(() => {
    if (!doc) return;
    document.title = `${doc.number} - ${doc.customer.name}`;
    const img = document.querySelector<HTMLImageElement>('.print-letterhead');
    const go = () => setTimeout(() => window.print(), 300);
    if (img && !img.complete) img.addEventListener('load', go, { once: true });
    else go();
  }, [doc]);

  if (doc === undefined) return <p className="muted">Loading…</p>;
  if (doc === null) return <p>Document not found.</p>;
  const title = doc.kind === 'quote' ? 'QUOTATION' : doc.isCashSale ? 'RECEIPT' : 'INVOICE';
  const paid = paidNgwee(doc);

  return (
    <div className="print-shell">
      <div className="print-toolbar no-print">
        <button className="ghost" onClick={() => window.history.back()}>
          Back
        </button>
        <button onClick={() => window.print()}>Print or save as PDF</button>
        <span className="muted">In the print window, choose "Save as PDF" to make a PDF file.</span>
      </div>
      <article className="sheet">
        <img className="print-letterhead" src={asset("letterhead.jpg")} alt="Patience Suppliers (Z) Ltd" />
        <header className="sheet-head">
          <div>
            <h1 className="doc-title">{title}</h1>
            {doc.status === 'void' && <div className="void-stamp">VOID</div>}
          </div>
          <table className="meta">
            <tbody>
              <tr>
                <th>{doc.kind === 'quote' ? 'Quotation no.' : doc.isCashSale ? 'Receipt no.' : 'Invoice no.'}</th>
                <td>{doc.number}</td>
              </tr>
              <tr>
                <th>Date</th>
                <td>{date(doc.createdAt)}</td>
              </tr>
              {!doc.isCashSale && (
                <tr>
                  <th>{doc.kind === 'quote' ? 'Valid until' : 'Payment due'}</th>
                  <td>{date(doc.dateLimit)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </header>
        {!doc.isCashSale && (
          <section className="bill-to">
            <div className="label">{doc.kind === 'quote' ? 'Prepared for' : 'Bill to'}</div>
            <strong>{doc.customer.name}</strong>
            {doc.customer.address && <div>{doc.customer.address}</div>}
            {doc.customer.phone && <div>{doc.customer.phone}</div>}
            {doc.customer.email && <div>{doc.customer.email}</div>}
          </section>
        )}
        <table className="sheet-lines">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Unit price (K)</th>
              <th className="num">Amount (K)</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={l.productId}>
                <td>{i + 1}</td>
                <td>
                  {l.name}
                  {l.code && <span className="code"> ({l.code})</span>}
                  {l.discountNgwee > 0 && <div className="disc">Less discount {formatNgwee(l.discountNgwee)}</div>}
                </td>
                <td className="num">
                  {l.quantity} {l.unit}
                </td>
                <td className="num">{formatNgwee(l.unitPriceNgwee).replace('K ', '')}</td>
                <td className="num">{formatNgwee(lineTotal(l)).replace('K ', '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="sheet-totals">
          {doc.discountNgwee > 0 && (
            <>
              <span>Subtotal</span>
              <span>{formatNgwee(doc.subtotalNgwee)}</span>
              <span>Discount</span>
              <span>− {formatNgwee(doc.discountNgwee)}</span>
            </>
          )}
          <span className="grand">Total (ZMW)</span>
          <span className="grand">{formatNgwee(doc.totalNgwee)}</span>
          {doc.kind === 'invoice' && paid > 0 && (
            <>
              <span>Paid</span>
              <span>{formatNgwee(paid)}</span>
              <span className="grand">Balance due</span>
              <span className="grand">{formatNgwee(doc.totalNgwee - paid)}</span>
            </>
          )}
        </div>
        {doc.notes && <p className="sheet-notes">{doc.notes}</p>}
        <footer className="sheet-foot">
          <p>Prices are in Zambian Kwacha. No VAT is charged.</p>
          {doc.kind === 'quote' && <p>This quotation is valid until {date(doc.dateLimit)}. Prices may change after this date.</p>}
          <p>Prepared by {doc.createdByName}. Thank you for your business.</p>
          <p className="brand-line">Quality products at affordable prices</p>
        </footer>
      </article>
    </div>
  );
}
