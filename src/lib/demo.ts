import { createOwner, createUser } from './users';
import { importProducts } from './inventory';
import { SAMPLE_PRODUCTS } from './sampleProducts';
import { convertQuote, createInvoice, createQuote, recordCashPayment } from './docs';
import { db } from '../db/db';

/** Logins created by the demo, shown on the preview link's sign-in page. */
export const DEMO_LOGINS = [
  { role: 'Owner', username: 'owner', password: 'Siavonga2026' },
  { role: 'Manager', username: 'manager', password: 'Stockroom2026' },
  { role: 'Staff', username: 'staff', password: 'Counter2026' },
];

/** Fills a fresh preview with example accounts, stock and documents so every screen has something in it. */
export async function seedDemo() {
  const owner = await createOwner({ username: 'owner', fullName: 'Demo Owner', password: DEMO_LOGINS[0].password });
  const manager = await createUser(owner, { username: 'manager', fullName: 'Demo Manager', password: DEMO_LOGINS[1].password, role: 'manager' });
  const staff = await createUser(manager, { username: 'staff', fullName: 'Demo Staff', password: DEMO_LOGINS[2].password, role: 'staff' });
  await importProducts(owner, SAMPLE_PRODUCTS, 'Sample items');
  const id = async (code: string) => (await db.products.where('code').equals(code).first())!.id;
  const builders = { name: 'Siavonga Builders Ltd (example)', phone: '+260 977 000 000', email: '', address: 'Plot 12, Siavonga' };
  const q = await createQuote(staff, {
    customer: builders,
    lines: [
      { productId: await id('HW-001'), quantity: 40 },
      { productId: await id('HW-002'), quantity: 25 },
      { productId: await id('TP-002'), quantity: 10 },
    ],
    notes: 'Example quotation. Delivery to site in Siavonga included.',
  });
  await createQuote(staff, {
    customer: { name: 'Lake Kariba Lodge (example)', phone: '', email: '', address: 'Siavonga' },
    lines: [{ productId: await id('TP-003'), quantity: 6 }, { productId: await id('TP-001'), quantity: 30 }],
  });
  const inv = await convertQuote(manager, q.id);
  await recordCashPayment(staff, inv.id, 500000);
  await createInvoice(staff, { customer: { name: '', phone: '', email: '', address: '' }, lines: [{ productId: await id('ST-001'), quantity: 2 }] }, { cashSale: true });
}
