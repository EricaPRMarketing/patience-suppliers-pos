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
  }
}

export const db = new PosDatabase();

export function newRecord(): SyncFields {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, syncState: 'pending' };
}
