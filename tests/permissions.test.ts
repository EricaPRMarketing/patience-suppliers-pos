import { describe, expect, it } from 'vitest';
import { can, canManageRole, canSeeActivityOf } from '../src/auth/permissions';

describe('permissions', () => {
  it('gives staff only selling rights', () => {
    expect(can('staff', 'quotes.create')).toBe(true);
    expect(can('staff', 'prices.edit')).toBe(false);
    expect(can('staff', 'users.view')).toBe(false);
  });
  it('lets managers edit stock and prices but not settings', () => {
    expect(can('manager', 'prices.edit')).toBe(true);
    expect(can('manager', 'settings.edit')).toBe(false);
  });
  it('limits who can manage which accounts', () => {
    expect(canManageRole('owner', 'manager')).toBe(true);
    expect(canManageRole('owner', 'owner')).toBe(false);
    expect(canManageRole('manager', 'staff')).toBe(true);
    expect(canManageRole('manager', 'manager')).toBe(false);
    expect(canManageRole('staff', 'staff')).toBe(false);
  });
  it('scopes the activity log by role', () => {
    const owner = { id: 'o', role: 'owner' as const };
    const manager = { id: 'm', role: 'manager' as const };
    const staff = { id: 's', role: 'staff' as const };
    const otherManager = { userId: 'm2', role: 'manager' as const };
    const otherStaff = { userId: 's2', role: 'staff' as const };
    expect(canSeeActivityOf(owner, otherManager)).toBe(true);
    expect(canSeeActivityOf(manager, otherStaff)).toBe(true);
    expect(canSeeActivityOf(manager, otherManager)).toBe(false);
    expect(canSeeActivityOf(staff, otherStaff)).toBe(false);
    expect(canSeeActivityOf(staff, { userId: 's', role: 'staff' })).toBe(true);
  });
});
