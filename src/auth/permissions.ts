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
  | 'settings.edit';

const STAFF: Permission[] = ['sales.create', 'quotes.create', 'invoices.create', 'inventory.view'];
const MANAGER: Permission[] = [
  ...STAFF,
  'inventory.edit',
  'inventory.import',
  'inventory.viewCost',
  'prices.edit',
  'payments.confirm',
  'users.view',
];
const OWNER: Permission[] = [...MANAGER, 'settings.edit'];

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
