import type { Role } from '../db/db';

export type Permission =
  | 'sales.create'
  | 'quotes.create'
  | 'invoices.create'
  | 'inventory.view'
  | 'inventory.edit'
  | 'inventory.import'
  | 'inventory.viewCost'
  | 'prices.edit'
  | 'payments.confirm'
  | 'users.view'
  | 'settings.edit'
  | 'security.view'
  | 'docs.discount'
  | 'docs.void';

const STAFF: Permission[] = ['sales.create', 'quotes.create', 'invoices.create', 'inventory.view'];
const MANAGER: Permission[] = [
  ...STAFF,
  'inventory.edit',
  'inventory.import',
  'inventory.viewCost',
  'docs.discount',
  'docs.void',
  'prices.edit',
  'payments.confirm',
  'users.view',
];
const OWNER: Permission[] = [...MANAGER, 'settings.edit', 'security.view'];

/** Plain-language summary shown on the Users page. */
export const ROLE_MATRIX: { label: string; staff: boolean; manager: boolean; owner: boolean }[] = [
  { label: 'Make sales, quotations and invoices', staff: true, manager: true, owner: true },
  { label: 'View stock and selling prices', staff: true, manager: true, owner: true },
  { label: 'See buying prices', staff: false, manager: true, owner: true },
  { label: 'Add items, change prices and adjust stock', staff: false, manager: true, owner: true },
  { label: 'Upload the stock list', staff: false, manager: true, owner: true },
  { label: 'Give discounts on quotations and invoices', staff: false, manager: true, owner: true },
  { label: 'Void (cancel) an issued invoice', staff: false, manager: true, owner: true },
  { label: 'Confirm payments', staff: false, manager: true, owner: true },
  { label: 'Add, lock out and reset staff accounts', staff: false, manager: true, owner: true },
  { label: 'Add and manage managers', staff: false, manager: false, owner: true },
  { label: "See other people's activity", staff: false, manager: true, owner: true },
  { label: "See managers' and the owner's activity", staff: false, manager: false, owner: true },
  { label: 'Security alerts and log tamper check', staff: false, manager: false, owner: true },
];

const BY_ROLE: Record<Role, ReadonlySet<Permission>> = {
  staff: new Set(STAFF),
  manager: new Set(MANAGER),
  owner: new Set(OWNER),
};

export const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', manager: 'Manager', staff: 'Staff' };

export function can(role: Role, permission: Permission): boolean {
  return BY_ROLE[role].has(permission);
}

/** Which roles an actor may create, edit, deactivate or reset. */
export function canManageRole(actor: Role, target: Role): boolean {
  if (actor === 'owner') return target !== 'owner';
  if (actor === 'manager') return target === 'staff';
  return false;
}

/**
 * Whose activity an actor may see.
 * Owner sees everyone. Manager sees their own and all staff. Staff see only their own.
 */
export function canSeeActivityOf(actor: { id: string; role: Role }, entry: { userId: string; role: Role }): boolean {
  if (actor.role === 'owner') return true;
  if (entry.userId === actor.id) return true;
  return actor.role === 'manager' && entry.role === 'staff';
}
