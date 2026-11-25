import { createOwner, createUser } from './users';
import { importProducts } from './inventory';
import { SAMPLE_PRODUCTS } from './sampleProducts';
import { convertQuote, createInvoice, createQuote, recordCashPayment } from './docs';
import { db } from '../db/db';
import { EMPTY_ACCOUNTS, recordPayment, savePaymentAccounts } from './payments';

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
  const accounts = structuredClone(EMPTY_ACCOUNTS);
  accounts.mobileMoney[0].number = '096 000 0000 (example)';
  accounts.mobileMoney[1].number = '097 000 0000 (example)';
  accounts.bank[0] = { ...accounts.bank[0], bank: 'Zanaco (example)', branch: 'Siavonga', accountNumber: '0000000000000', branchCode: '010000', swift: 'ZNCOZMLU' };
  await savePaymentAccounts(owner, accounts);
  // A mobile money payment waiting for the manager to check, with a sample screenshot as proof.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200"><rect width="360" height="200" rx="16" fill="#ffcb05"/><text x="20" y="45" font-family="sans-serif" font-size="20" font-weight="700">MoMo (example SMS)</text><text x="20" y="90" font-family="sans-serif" font-size="15">You have sent K 2,000.00 to</text><text x="20" y="115" font-family="sans-serif" font-size="15">PATIENCE SUPPLIERS. Ref INV-0001</text><text x="20" y="150" font-family="monospace" font-size="15">ID: MP261125.1015.A00001</text></svg>`;
  const popFileId = await saveDemoFile(staff.id, svg);
  await recordPayment(staff, inv.id, { method: 'mobile_money', amountNgwee: 200000, channel: 'MTN MoMo', payer: '+260 977 000 000', reference: 'MP261125.1015.A00001', popFileId });
  await createInvoice(staff, { customer: { name: '', phone: '', email: '', address: '' }, lines: [{ productId: await id('ST-001'), quantity: 2 }] }, { cashSale: true });
}

async function saveDemoFile(userId: string, svg: string): Promise<string> {
  const data = new TextEncoder().encode(svg).buffer as ArrayBuffer;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.files.add({ id, createdAt: now, updatedAt: now, syncState: 'pending', name: 'momo-sms.svg', type: 'image/svg+xml', size: data.byteLength, data, uploadedBy: userId });
  return id;
}
