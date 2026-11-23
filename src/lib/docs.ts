import {
  db,
  newRecord,
  type Customer,
  type DocLine,
  type Payment,
  type Product,
  type SalesDoc,
  type User,
} from '../db/db';
import { can } from '../auth/permissions';
import { logActivity } from './activity';
import { formatNgwee } from './format';

export class DocError extends Error {}

export interface DocInput {
  customer: Customer;
  lines: { productId: string; quantity: number; discountNgwee?: number }[];
  discountNgwee?: number;
  notes?: string;
  /** yyyy-mm-dd: quote valid until / invoice due date. */
  dateLimit?: string;
}

export const QUOTE_VALID_DAYS = 14;
export const INVOICE_DUE_DAYS = 7;

function isoDateIn(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function lineTotal(l: Pick<DocLine, 'quantity' | 'unitPriceNgwee' | 'discountNgwee'>): number {
  return Math.round(l.quantity * l.unitPriceNgwee) - l.discountNgwee;
}

export function paidNgwee(d: SalesDoc): number {
  return d.payments.filter((p) => p.status === 'confirmed').reduce((s, p) => s + p.amountNgwee, 0);
}

export type PaymentState = 'paid' | 'part' | 'unpaid' | 'void';

export function paymentState(d: SalesDoc): PaymentState {
  if (d.status === 'void') return 'void';
  const paid = paidNgwee(d);
  if (paid >= d.totalNgwee) return 'paid';
  return paid > 0 ? 'part' : 'unpaid';
}

export function isExpired(d: SalesDoc, today = new Date().toISOString().slice(0, 10)): boolean {
  return d.kind === 'quote' && (d.status === 'draft' || d.status === 'sent') && d.dateLimit < today;
}

/** Builds priced lines from inventory. Prices always come from inventory, never from the screen. */
async function buildLines(actor: User, input: DocInput): Promise<{ lines: DocLine[]; products: Map<string, Product> }> {
  if (input.lines.length === 0) throw new DocError('Add at least one item.');
  const products = new Map<string, Product>();
  const lines: DocLine[] = [];
  for (const l of input.lines) {
    const p = products.get(l.productId) ?? (await db.products.get(l.productId));
    if (!p || !p.active) throw new DocError('An item on this document is no longer in the stock list.');
    products.set(p.id, p);
    if (!Number.isFinite(l.quantity) || l.quantity <= 0) throw new DocError(`Enter a quantity for ${p.name}.`);
    const discount = Math.round(l.discountNgwee ?? 0);
    if (discount && !can(actor.role, 'docs.discount')) throw new DocError('Only managers and the owner can give discounts.');
    const line: DocLine = {
      productId: p.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      quantity: l.quantity,
      unitPriceNgwee: p.priceNgwee,
      discountNgwee: discount,
    };
    if (discount < 0 || lineTotal(line) < 0) throw new DocError(`The discount on ${p.name} is more than its price.`);
    lines.push(line);
  }
  return { lines, products };
}

function totals(lines: DocLine[], discountNgwee: number) {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  if (discountNgwee < 0 || discountNgwee > subtotal) throw new DocError('The discount is more than the total.');
  return { subtotalNgwee: subtotal, discountNgwee, totalNgwee: subtotal - discountNgwee };
}

function allDiscount(lines: DocLine[], docDiscount: number) {
  return lines.reduce((s, l) => s + l.discountNgwee, 0) + docDiscount;
}

async function nextNumber(kind: SalesDoc['kind'], now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const key = `seq.${kind}.${year}`;
  const n = Number((await db.settings.get(key))?.value ?? 0) + 1;
  await db.settings.put({ key, value: String(n) });
  return `${kind === 'quote' ? 'Q' : 'INV'}-${year}-${String(n).padStart(4, '0')}`;
}

function cleanCustomer(c: Customer): Customer {
  return {
    name: c.name.trim() || 'Cash customer',
    phone: c.phone.trim(),
    email: c.email.trim(),
    address: c.address.trim(),
  };
}

const TABLES = [db.docs, db.products, db.stockMovements, db.activity, db.settings];

/** Takes stock out for an issued invoice. Refuses to sell more than is in stock. */
async function takeStock(actor: User, doc: SalesDoc, sign: 1 | -1, reason: string) {
  const qtyById = new Map<string, number>();
  for (const l of doc.lines) qtyById.set(l.productId, (qtyById.get(l.productId) ?? 0) + l.quantity);
  for (const [productId, qty] of qtyById) {
    const p = await db.products.get(productId);
    if (!p) throw new DocError('An item on this invoice is missing from the stock list.');
    const quantity = p.quantity - sign * qty;
    if (quantity < 0) throw new DocError(`Not enough ${p.name} in stock: ${p.quantity} ${p.unit} left, ${qty} needed.`);
    const now = new Date().toISOString();
    await db.products.put({ ...p, quantity, updatedAt: now, syncState: 'pending' });
    await db.stockMovements.add({
      ...newRecord(),
      at: now,
      productId,
      change: -sign * qty,
      quantityAfter: quantity,
      reason,
      userId: actor.id,
      username: actor.username,
    });
  }
}

function discountMeta(doc: SalesDoc) {
  const discount = allDiscount(doc.lines, doc.discountNgwee);
  const gross = doc.lines.reduce((s, l) => s + Math.round(l.quantity * l.unitPriceNgwee), 0);
  return { discountNgwee: discount, grossNgwee: gross, totalNgwee: doc.totalNgwee };
}

export async function createQuote(actor: User, input: DocInput): Promise<SalesDoc> {
  const { lines } = await buildLines(actor, input);
  const t = totals(lines, Math.round(input.discountNgwee ?? 0));
  return db.transaction('rw', TABLES, async () => {
    const doc: SalesDoc = {
      ...newRecord(),
      kind: 'quote',
      number: await nextNumber('quote'),
      status: 'draft',
      customer: cleanCustomer(input.customer),
      lines,
      ...t,
      notes: input.notes?.trim() ?? '',
      dateLimit: input.dateLimit || isoDateIn(QUOTE_VALID_DAYS),
      createdBy: actor.id,
      createdByName: actor.fullName,
      fromQuoteId: null,
      convertedToId: null,
      payments: [],
      voidReason: '',
      isCashSale: false,
    };
    await db.docs.add(doc);
    await logActivity(actor, 'Quotation created', `${doc.number} for ${doc.customer.name}, ${formatNgwee(doc.totalNgwee)}`, {
      docId: doc.id,
      ...discountMeta(doc),
    });
    return doc;
  });
}

export async function updateQuote(actor: User, id: string, input: DocInput): Promise<SalesDoc> {
  const { lines } = await buildLines(actor, input);
  const t = totals(lines, Math.round(input.discountNgwee ?? 0));
  return db.transaction('rw', TABLES, async () => {
    const existing = await db.docs.get(id);
    if (!existing || existing.kind !== 'quote') throw new DocError('Quotation not found.');
    if (existing.status !== 'draft' && existing.status !== 'sent')
      throw new DocError('This quotation can no longer be changed.');
    const doc: SalesDoc = {
      ...existing,
      customer: cleanCustomer(input.customer),
      lines,
      ...t,
      notes: input.notes?.trim() ?? '',
      dateLimit: input.dateLimit || existing.dateLimit,
      updatedAt: new Date().toISOString(),
      syncState: 'pending',
    };
    await db.docs.put(doc);
    await logActivity(
      actor,
      'Quotation edited',
      `${doc.number}: ${formatNgwee(existing.totalNgwee)} to ${formatNgwee(doc.totalNgwee)}`,
      { docId: doc.id, ...discountMeta(doc) },
    );
    return doc;
  });
}

export async function setQuoteStatus(actor: User, id: string, status: 'sent' | 'accepted' | 'cancelled') {
  await db.transaction('rw', TABLES, async () => {
    const d = await db.docs.get(id);
    if (!d || d.kind !== 'quote') throw new DocError('Quotation not found.');
    if (d.status === 'converted' || d.status === 'cancelled') throw new DocError('This quotation is closed.');
    await db.docs.update(id, { status, updatedAt: new Date().toISOString(), syncState: 'pending' });
    const label = { sent: 'Quotation sent', accepted: 'Quotation accepted', cancelled: 'Quotation cancelled' }[status];
    await logActivity(actor, label, `${d.number} for ${d.customer.name}`, { docId: id });
  });
}

async function issue(
  actor: User,
  base: Omit<SalesDoc, keyof ReturnType<typeof newRecord> | 'number' | 'status' | 'kind'>,
  activity: string,
): Promise<SalesDoc> {
  const doc: SalesDoc = { ...newRecord(), kind: 'invoice', number: await nextNumber('invoice'), status: 'issued', ...base };
  await takeStock(actor, doc, 1, `Invoice ${doc.number}`);
  await db.docs.add(doc);
  await logActivity(actor, activity, `${doc.number} for ${doc.customer.name}, ${formatNgwee(doc.totalNgwee)}`, {
    docId: doc.id,
    ...discountMeta(doc),
  });
  return doc;
}

export async function createInvoice(actor: User, input: DocInput, opts: { cashSale?: boolean } = {}): Promise<SalesDoc> {
  const { lines } = await buildLines(actor, input);
  const t = totals(lines, Math.round(input.discountNgwee ?? 0));
  return db.transaction('rw', TABLES, async () => {
    const now = new Date().toISOString();
    const payments: Payment[] = opts.cashSale
      ? [
          {
            id: crypto.randomUUID(),
            at: now,
            method: 'cash',
            amountNgwee: t.totalNgwee,
            reference: 'Paid at the counter',
            userId: actor.id,
            username: actor.username,
            status: 'confirmed',
          },
        ]
      : [];
    return issue(
      actor,
      {
        customer: cleanCustomer(input.customer),
        lines,
        ...t,
        notes: input.notes?.trim() ?? '',
        dateLimit: input.dateLimit || isoDateIn(opts.cashSale ? 0 : INVOICE_DUE_DAYS),
        createdBy: actor.id,
        createdByName: actor.fullName,
        fromQuoteId: null,
        convertedToId: null,
        payments,
        voidReason: '',
        isCashSale: !!opts.cashSale,
      },
      opts.cashSale ? 'Cash sale' : 'Invoice issued',
    );
  });
}

/** Turns a quotation into an invoice at the quoted prices, and takes the stock out. */
export async function convertQuote(actor: User, quoteId: string): Promise<SalesDoc> {
  return db.transaction('rw', TABLES, async () => {
    const q = await db.docs.get(quoteId);
    if (!q || q.kind !== 'quote') throw new DocError('Quotation not found.');
    if (q.status === 'converted') throw new DocError('This quotation has already been invoiced.');
    if (q.status === 'cancelled') throw new DocError('This quotation was cancelled.');
    const inv = await issue(
      actor,
      {
        customer: q.customer,
        lines: q.lines,
        subtotalNgwee: q.subtotalNgwee,
        discountNgwee: q.discountNgwee,
        totalNgwee: q.totalNgwee,
        notes: q.notes,
        dateLimit: isoDateIn(INVOICE_DUE_DAYS),
        createdBy: actor.id,
        createdByName: actor.fullName,
        fromQuoteId: q.id,
        convertedToId: null,
        payments: [],
        voidReason: '',
        isCashSale: false,
      },
      'Invoice issued',
    );
    await db.docs.update(q.id, { status: 'converted', convertedToId: inv.id, updatedAt: inv.createdAt, syncState: 'pending' });
    await logActivity(actor, 'Quotation converted', `${q.number} became ${inv.number}`, { docId: q.id, invoiceId: inv.id });
    return inv;
  });
}

/** Cancels an issued invoice and puts its stock back. Managers and owner only, with a reason. */
export async function voidInvoice(actor: User, id: string, reason: string) {
  if (!can(actor.role, 'docs.void')) throw new DocError('Only managers and the owner can void an invoice.');
  if (!reason.trim()) throw new DocError('Give a reason for voiding the invoice.');
  await db.transaction('rw', TABLES, async () => {
    const d = await db.docs.get(id);
    if (!d || d.kind !== 'invoice') throw new DocError('Invoice not found.');
    if (d.status === 'void') throw new DocError('This invoice is already void.');
    await takeStock(actor, d, -1, `Void ${d.number}`);
    await db.docs.update(id, { status: 'void', voidReason: reason.trim(), updatedAt: new Date().toISOString(), syncState: 'pending' });
    await logActivity(actor, 'Invoice voided', `${d.number} for ${d.customer.name}, ${formatNgwee(d.totalNgwee)}: ${reason.trim()}`, {
      docId: id,
      totalNgwee: d.totalNgwee,
      paidNgwee: paidNgwee(d),
    });
  });
}

export async function recordCashPayment(actor: User, id: string, amountNgwee: number) {
  await db.transaction('rw', TABLES, async () => {
    const d = await db.docs.get(id);
    if (!d || d.kind !== 'invoice') throw new DocError('Invoice not found.');
    if (d.status === 'void') throw new DocError('This invoice is void.');
    const due = d.totalNgwee - paidNgwee(d);
    if (!Number.isFinite(amountNgwee) || amountNgwee <= 0) throw new DocError('Enter the amount received.');
    if (amountNgwee > due) throw new DocError(`Only ${formatNgwee(due)} is still owed.`);
    const payment: Payment = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      method: 'cash',
      amountNgwee: Math.round(amountNgwee),
      reference: '',
      userId: actor.id,
      username: actor.username,
      status: 'confirmed',
    };
    await db.docs.update(id, { payments: [...d.payments, payment], updatedAt: payment.at, syncState: 'pending' });
    await logActivity(actor, 'Cash payment recorded', `${d.number}: ${formatNgwee(payment.amountNgwee)}`, {
      docId: id,
      amountNgwee: payment.amountNgwee,
    });
  });
}

/** Document numbers missing from the sequence: a sign that a document was deleted outside the app. */
export async function missingDocNumbers(): Promise<string[]> {
  const docs = await db.docs.toArray();
  const missing: string[] = [];
  for (const kind of ['quote', 'invoice'] as const) {
    const byYear = new Map<string, Set<number>>();
    for (const d of docs.filter((x) => x.kind === kind)) {
      const [, year, n] = d.number.split('-');
      byYear.set(year, (byYear.get(year) ?? new Set()).add(Number(n)));
    }
    for (const [year, nums] of byYear) {
      const highest = Math.max(Number((await db.settings.get(`seq.${kind}.${year}`))?.value ?? 0), ...nums);
      for (let i = 1; i <= highest; i++)
        if (!nums.has(i)) missing.push(`${kind === 'quote' ? 'Q' : 'INV'}-${year}-${String(i).padStart(4, '0')}`);
    }
  }
  return missing;
}
