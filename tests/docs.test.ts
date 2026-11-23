import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { createOwner, createUser } from '../src/lib/users';
import { createProduct } from '../src/lib/inventory';
import {
  convertQuote, createInvoice, createQuote, DocError, missingDocNumbers, paymentState,
  recordCashPayment, updateQuote, voidInvoice,
} from '../src/lib/docs';
import { computeAlerts } from '../src/lib/alerts';

const cust = { name: 'Siavonga Builders', phone: '0977000000', email: '', address: 'Siavonga' };
let owner: Awaited<ReturnType<typeof createOwner>>;
let staff: Awaited<ReturnType<typeof createUser>>;
let cementId: string;

beforeEach(async () => {
  await db.delete();
  await db.open();
  owner = await createOwner({ username: 'owner', fullName: 'Owner', password: 'secret12' });
  staff = await createUser(owner, { username: 'till', fullName: 'Till One', password: 'secret12', role: 'staff' });
  cementId = (await createProduct(owner, { code: 'HW-1', name: 'Cement', category: 'B', unit: 'bag', priceNgwee: 16500, costNgwee: null, quantity: 20, reorderLevel: 5 })).id;
});

const qty = async () => (await db.products.get(cementId))!.quantity;

describe('quotations and invoices', () => {
  it('numbers documents in sequence and prices them from inventory', async () => {
    const q1 = await createQuote(staff, { customer: cust, lines: [{ productId: cementId, quantity: 10 }] });
    const q2 = await createQuote(staff, { customer: cust, lines: [{ productId: cementId, quantity: 2 }] });
    expect([q1.number, q2.number]).toEqual([`Q-${new Date().getFullYear()}-0001`, `Q-${new Date().getFullYear()}-0002`]);
    expect(q1.totalNgwee).toBe(165000);
    expect(await qty()).toBe(20); // quotes do not touch stock
  });

  it('does not let staff give discounts', async () => {
    await expect(
      createQuote(staff, { customer: cust, lines: [{ productId: cementId, quantity: 1, discountNgwee: 500 }] }),
    ).rejects.toThrow(/Only managers and the owner/);
    const q = await createQuote(owner, { customer: cust, lines: [{ productId: cementId, quantity: 2, discountNgwee: 3000 }], discountNgwee: 1000 });
    expect(q.totalNgwee).toBe(33000 - 3000 - 1000);
  });

  it('turns a quote into an invoice, takes stock out, and closes the quote', async () => {
    const q = await createQuote(staff, { customer: cust, lines: [{ productId: cementId, quantity: 5 }] });
    await updateQuote(staff, q.id, { customer: cust, lines: [{ productId: cementId, quantity: 6 }] });
    const inv = await convertQuote(staff, q.id);
    expect(inv.number).toMatch(/^INV-\d{4}-0001$/);
    expect(inv.totalNgwee).toBe(99000);
    expect(await qty()).toBe(14);
    expect((await db.docs.get(q.id))!.status).toBe('converted');
    await expect(convertQuote(staff, q.id)).rejects.toBeInstanceOf(DocError);
  });

  it('refuses to invoice more than is in stock', async () => {
    await expect(createInvoice(staff, { customer: cust, lines: [{ productId: cementId, quantity: 21 }] })).rejects.toThrow(/Not enough Cement/);
    expect(await qty()).toBe(20);
    expect(await db.docs.count()).toBe(0);
  });

  it('tracks payments and only lets managers void, returning stock', async () => {
    const inv = await createInvoice(staff, { customer: cust, lines: [{ productId: cementId, quantity: 4 }] });
    expect(paymentState(inv)).toBe('unpaid');
    await recordCashPayment(staff, inv.id, 30000);
    expect(paymentState((await db.docs.get(inv.id))!)).toBe('part');
    await expect(recordCashPayment(staff, inv.id, 40000)).rejects.toThrow(/Only K 360.00/);
    await expect(voidInvoice(staff, inv.id, 'oops')).rejects.toThrow(/Only managers/);
    await voidInvoice(owner, inv.id, 'Customer cancelled');
    expect(await qty()).toBe(20);
    const titles = (await computeAlerts()).map((a) => a.title);
    expect(titles).toContain('Invoice voided by owner');
  });

  it('records a cash sale as paid', async () => {
    const s = await createInvoice(staff, { customer: { name: '', phone: '', email: '', address: '' }, lines: [{ productId: cementId, quantity: 1 }] }, { cashSale: true });
    expect(s.customer.name).toBe('Cash customer');
    expect(paymentState(s)).toBe('paid');
  });

  it('notices a deleted invoice number', async () => {
    const a = await createInvoice(staff, { customer: cust, lines: [{ productId: cementId, quantity: 1 }] });
    await createInvoice(staff, { customer: cust, lines: [{ productId: cementId, quantity: 1 }] });
    await db.docs.delete(a.id);
    expect(await missingDocNumbers()).toEqual([a.number]);
  });
});
