import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { createOwner, createUser } from '../src/lib/users';
import {
  adjustStock,
  createProduct,
  importProducts,
  InventoryError,
  isLowStock,
  updateProduct,
  type ProductInput,
} from '../src/lib/inventory';

const item = (over: Partial<ProductInput> = {}): ProductInput => ({
  code: 'HW-1', name: 'Cement', category: 'Building', unit: 'bag',
  priceNgwee: 16500, costNgwee: 14000, quantity: 10, reorderLevel: 5, ...over,
});

let owner: Awaited<ReturnType<typeof createOwner>>;
beforeEach(async () => {
  await db.delete();
  await db.open();
  owner = await createOwner({ username: 'owner', fullName: 'Owner', password: 'secret12' });
});

describe('inventory', () => {
  it('only lets managers and the owner change stock', async () => {
    const staff = await createUser(owner, { username: 'till', fullName: 'Till', password: 'secret12', role: 'staff' });
    await expect(createProduct(staff, item())).rejects.toBeInstanceOf(InventoryError);
    await expect(importProducts(staff, [item()], 'x.csv')).rejects.toBeInstanceOf(InventoryError);
    const manager = await createUser(owner, { username: 'mgr', fullName: 'Mgr', password: 'secret12', role: 'manager' });
    await expect(createProduct(manager, item())).resolves.toMatchObject({ name: 'Cement' });
  });

  it('records stock movements and refuses to go below zero', async () => {
    const p = await createProduct(owner, item());
    await adjustStock(owner, p.id, 5, 'New delivery');
    await adjustStock(owner, p.id, -12, 'Damaged');
    await expect(adjustStock(owner, p.id, -4, 'Damaged')).rejects.toThrow(/Only 3/);
    const moves = await db.stockMovements.where('productId').equals(p.id).toArray();
    // Same-millisecond timestamps in a fast test, so compare without relying on order.
    expect(moves.map((m) => `${m.change}->${m.quantityAfter}`).sort()).toEqual(['-12->3', '10->10', '5->15']);
    expect(isLowStock((await db.products.get(p.id))!)).toBe(true);
  });

  it('logs price changes with old and new price', async () => {
    const p = await createProduct(owner, item());
    await updateProduct(owner, p.id, { ...item(), priceNgwee: 17000 });
    const log = await db.activity.where('action').equals('Price changed').first();
    expect(log?.details).toBe('Cement: K 165.00 to K 170.00');
  });

  it('rejects duplicate item codes', async () => {
    await createProduct(owner, item());
    await expect(createProduct(owner, item({ name: 'Other', code: 'hw-1' }))).rejects.toThrow(/already used/);
  });

  it('upload adds new items and updates existing ones by code, then by name', async () => {
    await createProduct(owner, item());
    await createProduct(owner, item({ code: '', name: 'River sand', quantity: 2 }));
    const s = await importProducts(
      owner,
      [
        item({ priceNgwee: 17500, quantity: 30 }),
        item({ code: '', name: 'river sand', quantity: 8 }),
        item({ code: 'TP-1', name: 'Paint', quantity: 4 }),
      ],
      'stock.xlsx',
    );
    expect(s).toEqual({ created: 1, updated: 2 });
    const all = await db.products.orderBy('name').toArray();
    expect(all.map((p) => [p.name, p.quantity, p.priceNgwee])).toEqual([
      ['Cement', 30, 17500],
      ['Paint', 4, 16500],
      ['river sand', 8, 16500],
    ]);
    const cement = all.find((p) => p.code === 'HW-1')!;
    const moves = await db.stockMovements.where('productId').equals(cement.id).toArray();
    expect(moves.map((m) => m.change).sort()).toEqual([10, 20]);
  });

  it('upload keeps stock and cost when the file has no column for them', async () => {
    const p = await createProduct(owner, item({ quantity: 40 }));
    await importProducts(owner, [item({ priceNgwee: 18000, quantity: 0, costNgwee: null })], 'prices.csv', [
      'code',
      'name',
      'priceNgwee',
    ]);
    const after = (await db.products.get(p.id))!;
    expect([after.priceNgwee, after.quantity, after.costNgwee]).toEqual([18000, 40, 14000]);
  });
});
