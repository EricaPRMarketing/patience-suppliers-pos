import Dexie, { type EntityTable } from 'dexie';

export type Role = 'owner' | 'manager' | 'staff';

/** Every record carries these so it can be synced to the cloud later. */
export interface SyncFields {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** 'pending' until the record has been sent to the cloud database. */
  syncState: 'pending' | 'synced';
}

export interface User extends SyncFields {
  username: string;
  fullName: string;
  role: Role;
  passwordHash: string;
  passwordSalt: string;
  active: boolean;
  createdBy: string | null;
  /** Consecutive wrong passwords since the last successful sign-in. */
  failedAttempts?: number;
  /** ISO time until which sign-in is blocked after too many wrong passwords. */
  lockedUntil?: string | null;
}

export interface ActivityEntry extends SyncFields {
  at: string;
  userId: string;
  username: string;
  role: Role;
  action: string;
  details: string;
  /** Structured facts used by the unusual-activity checks. */
  meta?: Record<string, string | number>;
  /** Position in the tamper-evident chain, starting at 1. */
  seq?: number;
  prevHash?: string;
  hash?: string;
}

export interface Product extends SyncFields {
  /** Item code / SKU. Unique when present. */
  code: string;
  name: string;
  category: string;
  /** e.g. each, bag, litre, metre, box */
  unit: string;
  /** Selling price in ngwee (K 1.00 = 100) to avoid rounding errors. No VAT. */
  priceNgwee: number;
  /** Optional buying price in ngwee, visible to managers and owner only. */
  costNgwee: number | null;
  quantity: number;
  /** Warn when quantity is at or below this. */
  reorderLevel: number;
  active: boolean;
}

export interface StockMovement extends SyncFields {
  at: string;
  productId: string;
  /** Positive adds stock, negative removes it. */
  change: number;
  quantityAfter: number;
  reason: string;
  userId: string;
  username: string;
}

export interface DocLine {
  productId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  /** Price from inventory at the time, in ngwee. */
  unitPriceNgwee: number;
  /** Discount on this line in ngwee (managers and owner only). */
  discountNgwee: number;
}

export interface Customer {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface Payment {
  id: string;
  at: string;
  method: 'cash' | 'mobile_money' | 'bank' | 'gateway';
  amountNgwee: number;
  reference: string;
  userId: string;
  username: string;
  /** Manual payments with proof of payment wait for a manager or the owner to check them. */
  status: 'confirmed' | 'pending' | 'rejected';
  /** Mobile money network or bank the customer paid into, e.g. "MTN MoMo". */
  channel?: string;
  /** Phone number or account the customer paid from. */
  payer?: string;
  /** Proof of payment (screenshot, SMS photo or bank slip) kept in the files table. */
  popFileId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

/** A file kept on the device, such as a proof of payment. */
export interface StoredFile extends SyncFields {
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer;
  uploadedBy: string;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'converted' | 'cancelled';
export type InvoiceStatus = 'issued' | 'void';

export interface SalesDoc extends SyncFields {
  kind: 'quote' | 'invoice';
  /** Q-2026-0001 or INV-2026-0001. Numbers are never reused, so a gap means a deleted document. */
  number: string;
  status: QuoteStatus | InvoiceStatus;
  customer: Customer;
  lines: DocLine[];
  subtotalNgwee: number;
  discountNgwee: number;
  totalNgwee: number;
  notes: string;
  /** Quotes: valid until. Invoices: due date. ISO date (yyyy-mm-dd). */
  dateLimit: string;
  createdBy: string;
  createdByName: string;
  fromQuoteId: string | null;
  convertedToId: string | null;
  payments: Payment[];
  voidReason: string;
  /** Quick till sale paid on the spot. */
  isCashSale: boolean;
}

export interface Setting {
  key: string;
  value: string;
}

export class PosDatabase extends Dexie {
  users!: EntityTable<User, 'id'>;
  activity!: EntityTable<ActivityEntry, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  products!: EntityTable<Product, 'id'>;
  stockMovements!: EntityTable<StockMovement, 'id'>;
  docs!: EntityTable<SalesDoc, 'id'>;
  files!: EntityTable<StoredFile, 'id'>;

  constructor(name = 'patience-pos') {
    super(name);
    this.version(1).stores({
      users: 'id, &username, role, active, syncState',
      activity: 'id, at, userId, role, action, syncState',
      settings: 'key',
    });
    this.version(2).stores({
      products: 'id, code, name, category, active, syncState',
      stockMovements: 'id, at, productId, userId, syncState',
    });
    this.version(3).stores({
      activity: 'id, at, userId, role, action, syncState, seq',
    });
    this.version(4).stores({
      docs: 'id, kind, number, status, createdAt, createdBy, syncState',
    });
    this.version(5).stores({
      files: 'id, createdAt, syncState',
    });
  }
}

export const db = new PosDatabase();

export function newRecord(): SyncFields {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, syncState: 'pending' };
}
