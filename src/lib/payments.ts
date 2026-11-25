import { db, newRecord, type Payment, type SalesDoc, type User } from '../db/db';
import { can } from '../auth/permissions';
import { logActivity } from './activity';
import { formatNgwee } from './format';
import { convertQuote, DocError, paidNgwee } from './docs';

/** Where customers send money. The owner fills these in; staff show them to the customer. */
export interface MobileMoneyAccount {
  network: string;
  number: string;
  accountName: string;
}
export interface BankAccount {
  bank: string;
  branch: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  swift: string;
}
export interface PaymentAccounts {
  mobileMoney: MobileMoneyAccount[];
  bank: BankAccount[];
}

const ACCOUNTS_KEY = 'payment.accounts';
const COMPANY = 'Patience Suppliers (Z) Ltd';

export const EMPTY_ACCOUNTS: PaymentAccounts = {
  mobileMoney: [
    { network: 'MTN MoMo', number: '', accountName: COMPANY },
    { network: 'Airtel Money', number: '', accountName: COMPANY },
    { network: 'Zamtel Kwacha', number: '', accountName: COMPANY },
  ],
  bank: [{ bank: '', branch: '', accountName: COMPANY, accountNumber: '', branchCode: '', swift: '' }],
};

export async function getPaymentAccounts(): Promise<PaymentAccounts> {
  try {
    const raw = (await db.settings.get(ACCOUNTS_KEY))?.value;
    return raw ? (JSON.parse(raw) as PaymentAccounts) : EMPTY_ACCOUNTS;
  } catch {
    return EMPTY_ACCOUNTS;
  }
}

/** Accounts that are filled in and can be shown to a customer. */
export function usableAccounts(a: PaymentAccounts) {
  return {
    mobileMoney: a.mobileMoney.filter((m) => m.number.trim()),
    bank: a.bank.filter((b) => b.bank.trim() && b.accountNumber.trim()),
  };
}

function describe(a: PaymentAccounts): string {
  const u = usableAccounts(a);
  return [...u.mobileMoney.map((m) => `${m.network} ${m.number}`), ...u.bank.map((b) => `${b.bank} ${b.accountNumber}`)].join(', ') || 'none';
}

/** Owner only. Changing where money goes is a classic way to divert payments, so it is always logged and alerted. */
export async function savePaymentAccounts(actor: User, accounts: PaymentAccounts) {
  if (!can(actor.role, 'settings.edit')) throw new DocError('Only the owner can change the payment details.');
  const clean: PaymentAccounts = {
    mobileMoney: accounts.mobileMoney.map((m) => ({ network: m.network.trim(), number: m.number.trim(), accountName: m.accountName.trim() })),
    bank: accounts.bank.map((b) => ({
      bank: b.bank.trim(),
      branch: b.branch.trim(),
      accountName: b.accountName.trim(),
      accountNumber: b.accountNumber.trim(),
      branchCode: b.branchCode.trim(),
      swift: b.swift.trim(),
    })),
  };
  await db.transaction('rw', [db.settings, db.activity], async () => {
    const before = await getPaymentAccounts();
    await db.settings.put({ key: ACCOUNTS_KEY, value: JSON.stringify(clean) });
    await logActivity(actor, 'Payment details changed', `From: ${describe(before)}. To: ${describe(clean)}`);
  });
}

export const MAX_POP_BYTES = 5 * 1024 * 1024;
const POP_TYPES = /^(image\/|application\/pdf$)/;

/** Keeps a proof of payment on the device. Returns its id. */
export async function saveProofOfPayment(actor: User, file: File): Promise<string> {
  if (!POP_TYPES.test(file.type)) throw new DocError('Attach a photo, screenshot or PDF of the payment.');
  if (file.size > MAX_POP_BYTES) throw new DocError('That file is too big. Use a file under 5 MB.');
  const rec = { ...newRecord(), name: file.name, type: file.type, size: file.size, data: await file.arrayBuffer(), uploadedBy: actor.id };
  await db.files.add(rec);
  return rec.id;
}

export async function openFile(id: string): Promise<{ url: string; type: string; name: string } | null> {
  const f = await db.files.get(id);
  return f ? { url: URL.createObjectURL(new Blob([f.data], { type: f.type })), type: f.type, name: f.name } : null;
}

/** What can still be paid: total minus confirmed payments and payments waiting to be checked. */
export function openBalance(d: SalesDoc): number {
  const pending = d.payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amountNgwee, 0);
  return d.totalNgwee - paidNgwee(d) - pending;
}

export type Method = 'cash' | 'mobile_money' | 'bank';
export const METHOD_LABEL: Record<Payment['method'], string> = {
  cash: 'Cash',
  mobile_money: 'Mobile money',
  bank: 'Bank transfer',
  gateway: 'Online payment',
};

export interface PaymentInput {
  method: Method;
  amountNgwee: number;
  /** Transaction ID from the mobile money SMS, or the bank reference. */
  reference?: string;
  channel?: string;
  payer?: string;
  popFileId?: string;
}

const TABLES = [db.docs, db.activity, db.settings];

/**
 * Records a payment against an invoice. Cash is confirmed at once.
 * Mobile money and bank need the transaction reference and a proof of payment, and wait for a manager or the owner.
 */
/** Checks a payment before anything is saved. */
async function checkInput(input: PaymentInput, due: number) {
  const amount = Math.round(input.amountNgwee);
  if (!Number.isFinite(amount) || amount <= 0) throw new DocError('Enter the amount received.');
  if (amount > due) throw new DocError(due > 0 ? `Only ${formatNgwee(due)} is still owed.` : 'Nothing is owed on this invoice.');
  if (input.method === 'cash') return;
  const reference = input.reference?.trim() ?? '';
  if (!input.channel?.trim()) throw new DocError(input.method === 'bank' ? 'Choose the bank the customer paid into.' : 'Choose the mobile money network.');
  if (!reference) throw new DocError(input.method === 'bank' ? 'Enter the bank reference.' : 'Enter the transaction ID from the payment SMS.');
  if (!input.popFileId) throw new DocError('Attach the proof of payment.');
  // The same SMS or bank slip shown twice is a common trick: one real payment, two invoices marked paid.
  const ref = reference.toLowerCase();
  const all = await db.docs.where('kind').equals('invoice').toArray();
  const used = all.find((x) => x.payments.some((p) => p.status !== 'rejected' && p.method === input.method && p.reference.trim().toLowerCase() === ref));
  if (used) throw new DocError(`That reference was already used for a payment on ${used.number}. Check the proof of payment.`);
}

export async function recordPayment(actor: User, invoiceId: string, input: PaymentInput): Promise<Payment> {
  const amount = Math.round(input.amountNgwee);
  const manual = input.method !== 'cash';
  const reference = input.reference?.trim() ?? '';
  return db.transaction('rw', TABLES, async () => {
    const d = await db.docs.get(invoiceId);
    if (!d || d.kind !== 'invoice') throw new DocError('Invoice not found.');
    if (d.status === 'void') throw new DocError('This invoice is void.');
    await checkInput(input, openBalance(d));
    const payment: Payment = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      method: input.method,
      amountNgwee: amount,
      reference: manual ? reference : reference || 'Paid at the counter',
      userId: actor.id,
      username: actor.username,
      status: manual ? 'pending' : 'confirmed',
      ...(manual && { channel: input.channel!.trim(), payer: input.payer?.trim() ?? '', popFileId: input.popFileId }),
    };
    await db.docs.update(invoiceId, { payments: [...d.payments, payment], updatedAt: payment.at, syncState: 'pending' });
    await logActivity(
      actor,
      manual ? 'Payment proof submitted' : 'Cash payment recorded',
      `${d.number}: ${formatNgwee(amount)}${manual ? ` by ${METHOD_LABEL[input.method].toLowerCase()} (${payment.channel}, ref ${reference})` : ''}`,
      { docId: invoiceId, amountNgwee: amount, paymentId: payment.id },
    );
    return payment;
  });
}

/** Takes payment for a quotation: turns it into an invoice first, then records the payment on that invoice. */
export async function payQuote(actor: User, quoteId: string, input: PaymentInput): Promise<SalesDoc> {
  const q = await db.docs.get(quoteId);
  if (!q || q.kind !== 'quote') throw new DocError('Quotation not found.');
  if (q.status === 'cancelled') throw new DocError('This quotation was cancelled.');
  if (!q.convertedToId) await checkInput(input, q.totalNgwee);
  const inv = q.convertedToId ? await db.docs.get(q.convertedToId) : await convertQuote(actor, quoteId);
  if (!inv) throw new DocError('The invoice for this quotation is missing.');
  await recordPayment(actor, inv.id, input);
  return (await db.docs.get(inv.id))!;
}

/**
 * A manager or the owner checks a mobile money or bank payment against the company's statement.
 * Nobody can approve a payment they recorded themselves, except the owner.
 */
export async function reviewPayment(actor: User, invoiceId: string, paymentId: string, approve: boolean, note = '') {
  if (!can(actor.role, 'payments.confirm')) throw new DocError('Only managers and the owner can confirm payments.');
  if (!approve && !note.trim()) throw new DocError('Say why the payment is rejected.');
  await db.transaction('rw', TABLES, async () => {
    const d = await db.docs.get(invoiceId);
    const p = d?.payments.find((x) => x.id === paymentId);
    if (!d || !p) throw new DocError('Payment not found.');
    if (p.status !== 'pending') throw new DocError('This payment has already been checked.');
    if (p.userId === actor.id && actor.role !== 'owner') throw new DocError('Someone else must check a payment you recorded yourself.');
    const now = new Date().toISOString();
    const updated: Payment = { ...p, status: approve ? 'confirmed' : 'rejected', reviewedBy: actor.username, reviewedAt: now, reviewNote: note.trim() };
    await db.docs.update(invoiceId, { payments: d.payments.map((x) => (x.id === paymentId ? updated : x)), updatedAt: now, syncState: 'pending' });
    await logActivity(
      actor,
      approve ? 'Payment confirmed' : 'Payment rejected',
      `${d.number}: ${formatNgwee(p.amountNgwee)} ${METHOD_LABEL[p.method].toLowerCase()} (${p.channel}, ref ${p.reference}) recorded by ${p.username}${note.trim() ? `. ${note.trim()}` : ''}`,
      { docId: invoiceId, paymentId, amountNgwee: p.amountNgwee, recordedBy: p.username },
    );
  });
}

export interface PaymentRow {
  doc: SalesDoc;
  payment: Payment;
}

export async function allPayments(): Promise<PaymentRow[]> {
  const docs = await db.docs.where('kind').equals('invoice').toArray();
  return docs.flatMap((doc) => doc.payments.map((payment) => ({ doc, payment }))).sort((a, b) => b.payment.at.localeCompare(a.payment.at));
}
