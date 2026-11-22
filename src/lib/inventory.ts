import { db, newRecord, type Product, type User } from '../db/db';
import { can } from '../auth/permissions';
import { logActivity } from './activity';
import { formatNgwee } from './format';

export class InventoryError extends Error {}

export interface ProductInput {
  code: string;
  name: string;
  category: string;
  unit: string;
  priceNgwee: number;
  costNgwee: number | null;
  quantity: number;
  reorderLevel: number;
}

function requireEdit(actor: User) {
  if (!can(actor.role, 'inventory.edit')) throw new InventoryError('Only managers and the owner can change stock.');
}

function clean(input: ProductInput): ProductInput {
  const out: ProductInput = {
    code: input.code.trim(),
    name: input.name.trim(),
    category: input.category.trim() || 'Uncategorised',
    unit: input.unit.trim() || 'each',
    priceNgwee: Math.round(input.priceNgwee),
    costNgwee: input.costNgwee == null ? null : Math.round(input.costNgwee),
    quantity: input.quantity,
    reorderLevel: input.reorderLevel,
  };
  if (!out.name) throw new InventoryError('Every item needs a name.');
  if (!Number.isFinite(out.priceNgwee) || out.priceNgwee < 0) throw new InventoryError('Enter a valid selling price.');
  if (out.costNgwee != null && (!Number.isFinite(out.costNgwee) || out.costNgwee < 0))
    throw new InventoryError('Enter a valid buying price.');
  if (!Number.isFinite(out.quantity) || out.quantity < 0) throw new InventoryError('Quantity cannot be negative.');
  if (!Number.isFinite(out.reorderLevel) || out.reorderLevel < 0)
    throw new InventoryError('Low-stock level cannot be negative.');
  return out;
}

async function codeTaken(code: string, exceptId?: string): Promise<boolean> {
  if (!code) return false;
  const lower = code.toLowerCase();
  const matches = await db.products.filter((p) => p.code.toLowerCase() === lower && p.id !== exceptId).count();
  return matches > 0;
}

async function recordMovement(actor: User, product: Product, change: number, reason: string) {
  if (change === 0) return;
  await db.stockMovements.add({
    ...newRecord(),
    at: new Date().toISOString(),
    productId: product.id,
    change,
    quantityAfter: product.quantity,
    reason,
    userId: actor.id,
    username: actor.username,
  });
}

export async function createProduct(actor: User, input: ProductInput): Promise<Product> {
  requireEdit(actor);
  const data = clean(input);
  return db.transaction('rw', db.products, db.stockMovements, db.activity, async () => {
    if (await codeTaken(data.code)) throw new InventoryError(`Item code "${data.code}" is already used.`);
    const product: Product = { ...newRecord(), ...data, active: true };
    await db.products.add(product);
    await recordMovement(actor, product, product.quantity, 'Opening stock');
    await logActivity(actor, 'Item added', `${product.name} at ${formatNgwee(product.priceNgwee)}, ${product.quantity} in stock`);
    return product;
  });
}

/** Edits details and price. Quantity changes go through adjustStock so they are always explained. */
export async function updateProduct(
  actor: User,
  id: string,
  input: Omit<ProductInput, 'quantity'>,
): Promise<Product> {
  requireEdit(actor);
  return db.transaction('rw', db.products, db.activity, async () => {
    const existing = await db.products.get(id);
    if (!existing) throw new InventoryError('Item not found.');
    const data = clean({ ...input, quantity: existing.quantity });
    if (data.priceNgwee !== existing.priceNgwee && !can(actor.role, 'prices.edit'))
      throw new InventoryError('You are not allowed to change prices.');
    if (await codeTaken(data.code, id)) throw new InventoryError(`Item code "${data.code}" is already used.`);
    const updated: Product = { ...existing, ...data, updatedAt: new Date().toISOString(), syncState: 'pending' };
    await db.products.put(updated);
    if (data.priceNgwee !== existing.priceNgwee)
      await logActivity(
        actor,
        'Price changed',
        `${updated.name}: ${formatNgwee(existing.priceNgwee)} to ${formatNgwee(updated.priceNgwee)}`,
      );
    else await logActivity(actor, 'Item edited', updated.name);
    return updated;
  });
}

export async function adjustStock(actor: User, id: string, change: number, reason: string): Promise<Product> {
  requireEdit(actor);
  if (!Number.isFinite(change) || change === 0) throw new InventoryError('Enter how many to add or remove.');
  if (!reason.trim()) throw new InventoryError('Give a reason for the stock change.');
  return db.transaction('rw', db.products, db.stockMovements, db.activity, async () => {
    const existing = await db.products.get(id);
    if (!existing) throw new InventoryError('Item not found.');
    const quantity = existing.quantity + change;
    if (quantity < 0) throw new InventoryError(`Only ${existing.quantity} ${existing.unit} in stock.`);
    const updated: Product = { ...existing, quantity, updatedAt: new Date().toISOString(), syncState: 'pending' };
    await db.products.put(updated);
    await recordMovement(actor, updated, change, reason.trim());
    await logActivity(
      actor,
      change > 0 ? 'Stock added' : 'Stock removed',
      `${updated.name}: ${change > 0 ? '+' : ''}${change} (${reason.trim()}), now ${quantity}`,
    );
    return updated;
  });
}

export async function setProductActive(actor: User, id: string, active: boolean) {
  requireEdit(actor);
  const p = await db.products.get(id);
  if (!p) throw new InventoryError('Item not found.');
  await db.products.update(id, { active, updatedAt: new Date().toISOString(), syncState: 'pending' });
  await logActivity(actor, active ? 'Item restored' : 'Item archived', p.name);
}

export function isLowStock(p: Pick<Product, 'quantity' | 'reorderLevel'>): boolean {
  return p.quantity <= p.reorderLevel;
}

const ALL_FIELDS: (keyof ProductInput)[] = [
  'code',
  'name',
  'category',
  'unit',
  'priceNgwee',
  'costNgwee',
  'quantity',
  'reorderLevel',
];

export interface ImportSummary {
  created: number;
  updated: number;
}

/**
 * Adds new items and updates existing ones. Items match on item code, or on name when there is no code.
 * The file's quantity becomes the stock level, and the difference is recorded as a stock movement.
 */
export async function importProducts(
  actor: User,
  items: ProductInput[],
  fileName: string,
  fields: (keyof ProductInput)[] = ALL_FIELDS,
): Promise<ImportSummary> {
  if (!can(actor.role, 'inventory.import')) throw new InventoryError('Only managers and the owner can upload stock.');
  const cleaned = items.map(clean);
  return db.transaction('rw', db.products, db.stockMovements, db.activity, async () => {
    const all = await db.products.toArray();
    const byCode = new Map(all.filter((p) => p.code).map((p) => [p.code.toLowerCase(), p]));
    const byName = new Map(all.map((p) => [p.name.toLowerCase(), p]));
    let created = 0;
    let updated = 0;
    const now = new Date().toISOString();
    for (const item of cleaned) {
      const match = item.code ? byCode.get(item.code.toLowerCase()) : byName.get(item.name.toLowerCase());
      if (match) {
        // Only overwrite what the file has a column for, so a file without a Quantity column keeps current stock.
        const provided = Object.fromEntries(fields.map((f) => [f, item[f]])) as Partial<ProductInput>;
        const next: Product = { ...match, ...provided, active: true, updatedAt: now, syncState: 'pending' };
        await db.products.put(next);
        await recordMovement(actor, next, next.quantity - match.quantity, `Stock upload: ${fileName}`);
        byName.set(next.name.toLowerCase(), next);
        if (next.code) byCode.set(next.code.toLowerCase(), next);
        updated++;
      } else {
        const product: Product = { ...newRecord(), ...item, active: true };
        await db.products.add(product);
        await recordMovement(actor, product, product.quantity, `Stock upload: ${fileName}`);
        byName.set(product.name.toLowerCase(), product);
        if (product.code) byCode.set(product.code.toLowerCase(), product);
        created++;
      }
    }
    await logActivity(actor, 'Stock uploaded', `${fileName}: ${created} new, ${updated} updated`);
    return { created, updated };
  });
}
