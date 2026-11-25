import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { createOwner, createUser } from '../src/lib/users';
import { createProduct } from '../src/lib/inventory';
import { createInvoice, createQuote, paymentState } from '../src/lib/docs';
import { activityAlerts } from '../src/lib/alerts';
import {
  EMPTY_ACCOUNTS, getPaymentAccounts, openBalance, payQuote, recordPayment, reviewPayment, savePaymentAccounts, saveProofOfPayment,
} from '../src/lib/payments';

const cust = { name: 'Siavonga Builders', phone: '0977000000', email: '', address: 'Siavonga' };
let owner: Awaited<ReturnType<typeof createOwner>>;
let manager: Awaited<ReturnType<typeof createUser>>;
let staff: Awaited<ReturnType<typeof createUser>>;
let cementId: string;
let pop: string;

const file = (type = 'image/png', size = 10) => new File([new Uint8Array(size)], 'pop.png', { type });

beforeEach(async () => {
  await db.delete();
  await db.open();
  owner = await createOwner({ username: 'owner', fullName: 'Owner', password: 'secret12' });
  manager = await createUser(owner, { username: 'boss', fullName: 'Manager', password: 'secret12', role: 'manager' });
  staff = await createUser(owner, { username: 'till', fullName: 'Till One', password: 'secret12', role: 'staff' });
  cementId = (await createProduct(owner, { code: 'HW-1', name: 'Cement', category: 'B', unit: 'bag', priceNgwee: 16500, costNgwee: null, quantity: 20, reorderLevel: 5 })).id;
  pop = await saveProofOfPayment(staff, file());
});

const invoice = () => createInvoice(staff, { customer: cust, lines: [{ productId: cementId, quantity: 2 }] }); // K 330

describe('payments', () => {
  it('needs a reference and proof for mobile money, and waits for a manager', async () => {
    const inv = await invoice();
    await expect(recordPayment(staff, inv.id, { method: 'mobile_money', amountNgwee: 33000, channel: 'MTN MoMo' })).rejects.toThrow(/transaction ID/);
    await expect(recordPayment(staff, inv.id, { method: 'mobile_money', amountNgwee: 33000, channel: 'MTN MoMo', reference: 'MP123' })).rejects.toThrow(/proof of payment/);
    const p = await recordPayment(staff, inv.id, { method: 'mobile_money', amountNgwee: 33000, channel: 'MTN MoMo', reference: 'MP123', popFileId: pop });
    let d = (await db.docs.get(inv.id))!;
    expect(p.status).toBe('pending');
    expect(paymentState(d)).toBe('unpaid'); // not counted until checked
    expect(openBalance(d)).toBe(0); // but nobody can take the same money twice
    await expect(reviewPayment(staff, inv.id, p.id, true)).rejects.toThrow(/Only managers/);
    await reviewPayment(manager, inv.id, p.id, true);
    d = (await db.docs.get(inv.id))!;
    expect(paymentState(d)).toBe('paid');
    expect(d.payments[0].reviewedBy).toBe('boss');
  });

  it('refuses a transaction reference used before', async () => {
    const a = await invoice();
    const b = await invoice();
    await recordPayment(staff, a.id, { method: 'mobile_money', amountNgwee: 10000, channel: 'Airtel Money', reference: 'ABC1', popFileId: pop });
    await expect(
      recordPayment(staff, b.id, { method: 'mobile_money', amountNgwee: 10000, channel: 'Airtel Money', reference: 'abc1 ', popFileId: pop }),
    ).rejects.toThrow(/already used/);
  });

  it('stops managers approving their own payments, and needs a reason to reject', async () => {
    const inv = await invoice();
    const p = await recordPayment(manager, inv.id, { method: 'bank', amountNgwee: 33000, channel: 'Zanaco', reference: 'FT991', popFileId: pop });
    await expect(reviewPayment(manager, inv.id, p.id, true)).rejects.toThrow(/Someone else/);
    await expect(reviewPayment(owner, inv.id, p.id, false)).rejects.toThrow(/why/);
    await reviewPayment(owner, inv.id, p.id, false, 'Not on the bank statement');
    const d = (await db.docs.get(inv.id))!;
    expect(d.payments[0].status).toBe('rejected');
    expect(openBalance(d)).toBe(33000);
  });

  it('takes payment for a quotation by invoicing it first', async () => {
    const q = await createQuote(staff, { customer: cust, lines: [{ productId: cementId, quantity: 4 }] });
    const inv = await payQuote(staff, q.id, { method: 'cash', amountNgwee: 66000 });
    expect(inv.kind).toBe('invoice');
    expect(paymentState(inv)).toBe('paid');
    expect((await db.docs.get(q.id))!.status).toBe('converted');
    expect((await db.products.get(cementId))!.quantity).toBe(16);
  });

  it('does not invoice a quotation when the payment is wrong', async () => {
    const q = await createQuote(staff, { customer: cust, lines: [{ productId: cementId, quantity: 1 }] });
    await expect(payQuote(staff, q.id, { method: 'cash', amountNgwee: 99999 })).rejects.toThrow(/Only K 165.00/);
    expect((await db.docs.get(q.id))!.status).toBe('draft');
  });

  it('lets only the owner change payment details, and alerts the owner', async () => {
    const acc = structuredClone(EMPTY_ACCOUNTS);
    acc.mobileMoney[0].number = '0961000000';
    await expect(savePaymentAccounts(manager, acc)).rejects.toThrow(/Only the owner/);
    await savePaymentAccounts(owner, acc);
    expect((await getPaymentAccounts()).mobileMoney[0].number).toBe('0961000000');
    const alerts = activityAlerts(await db.activity.toArray());
    expect(alerts.some((a) => a.title.includes('details changed') && a.severity === 'high')).toBe(true);
  });

  it('only accepts images or PDFs under 5 MB as proof', async () => {
    await expect(saveProofOfPayment(staff, file('text/plain'))).rejects.toThrow(/photo, screenshot or PDF/);
    await expect(saveProofOfPayment(staff, file('application/pdf', 6 * 1024 * 1024))).rejects.toThrow(/too big/);
  });
});
