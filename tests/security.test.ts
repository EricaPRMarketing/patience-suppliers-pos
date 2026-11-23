import { beforeEach, describe, expect, it } from 'vitest';
import { db, type ActivityEntry } from '../src/db/db';
import { createOwner, createUser, signIn, unlockUser } from '../src/lib/users';
import { logActivity, verifyActivityLog } from '../src/lib/activity';
import { activityAlerts, computeAlerts } from '../src/lib/alerts';
import { adjustStock, createProduct } from '../src/lib/inventory';
import { passwordProblem } from '../src/auth/password';

let owner: Awaited<ReturnType<typeof createOwner>>;
beforeEach(async () => {
  await db.delete();
  await db.open();
  owner = await createOwner({ username: 'owner', fullName: 'Owner', password: 'secret12' });
});

describe('passwords', () => {
  it('needs 8+ characters with letters and numbers, not the username', () => {
    expect(passwordProblem('abc123')).toMatch(/8/);
    expect(passwordProblem('abcdefgh')).toMatch(/letters and numbers/);
    expect(passwordProblem('jane2024x', 'jane')).toMatch(/username/);
    expect(passwordProblem('password1')).toMatch(/easy/);
    expect(passwordProblem('Kafue77river')).toBeNull();
  });
});

describe('sign-in lockout', () => {
  it('locks after 5 wrong passwords, even for the right one, until unlocked', async () => {
    const staff = await createUser(owner, { username: 'till', fullName: 'Till', password: 'secret12', role: 'staff' });
    for (let i = 0; i < 4; i++) expect(await signIn('till', 'wrong123')).toEqual({ ok: false, reason: 'invalid' });
    expect(await signIn('till', 'wrong123')).toMatchObject({ ok: false, reason: 'locked' });
    expect(await signIn('till', 'secret12')).toMatchObject({ ok: false, reason: 'locked' });
    await unlockUser(owner, staff.id);
    expect(await signIn('till', 'secret12')).toMatchObject({ ok: true });
    const actions = (await db.activity.toArray()).map((a) => a.action);
    expect(actions).toContain('Account locked');
    expect(actions).toContain('Sign-in attempt while locked');
  });

  it('lifts the lock after 15 minutes', async () => {
    await createUser(owner, { username: 'till', fullName: 'Till', password: 'secret12', role: 'staff' });
    for (let i = 0; i < 5; i++) await signIn('till', 'wrong123');
    const later = new Date(Date.now() + 16 * 60_000);
    expect(await signIn('till', 'secret12', later)).toMatchObject({ ok: true });
  });
});

describe('tamper-evident activity log', () => {
  it('is intact after normal use', async () => {
    await logActivity(owner, 'Test', 'one');
    await logActivity(owner, 'Test', 'two');
    expect(await verifyActivityLog()).toMatchObject({ ok: true, checked: 3 });
  });

  it('detects an edited entry', async () => {
    await logActivity(owner, 'Stock removed', 'Cement: -50');
    const e = (await db.activity.where('action').equals('Stock removed').first())!;
    await db.activity.update(e.id, { details: 'Cement: -1' });
    const r = await verifyActivityLog();
    expect(r.ok).toBe(false);
    expect(r.problems[0].problem).toMatch(/changed after it was written/);
  });

  it('detects deleted entries in the middle and at the end', async () => {
    for (const n of ['a', 'b', 'c']) await logActivity(owner, 'Test', n);
    const middle = (await db.activity.where('seq').equals(2).first())!;
    await db.activity.delete(middle.id);
    expect((await verifyActivityLog()).problems[0].problem).toMatch(/deleted before entry 3/);
    const lastOne = (await db.activity.orderBy('seq').last())!;
    await db.activity.delete(lastOne.id);
    expect((await verifyActivityLog()).problems.map((p) => p.problem).join()).toMatch(/newest 1 log entries were deleted/);
  });
});

describe('unusual activity', () => {
  const entry = (over: Partial<ActivityEntry>): ActivityEntry => ({
    id: Math.random().toString(36), createdAt: '', updatedAt: '', syncState: 'pending',
    at: '2026-11-23T10:00:00', userId: 's1', username: 'till', role: 'staff', action: '', details: '', ...over,
  });

  it('flags a price lowered and put back', () => {
    const alerts = activityAlerts([
      entry({ action: 'Price changed', details: 'Cement: K 165.00 to K 100.00', meta: { productId: 'p', oldNgwee: 16500, newNgwee: 10000 }, role: 'manager', username: 'mgr' }),
      entry({ at: '2026-11-23T12:00:00', action: 'Price changed', details: 'Cement: K 100.00 to K 165.00', meta: { productId: 'p', oldNgwee: 10000, newNgwee: 16500 }, role: 'manager', username: 'mgr' }),
    ]);
    expect(alerts.map((a) => a.title)).toEqual(['Big price cut by mgr', 'Price lowered and then put back']);
  });

  it('flags staff working at night and repeated write-offs', () => {
    const night = entry({ at: '2026-11-23T22:30:00', action: 'Item edited' });
    const removals = [1, 2, 3].map((i) =>
      entry({ at: `2026-11-23T1${i}:00:00`, action: 'Stock removed', details: `Paint: -1 (Damaged)`, meta: { change: -1, before: 100, valueNgwee: 100 } }),
    );
    const titles = activityAlerts([night, ...removals]).map((a) => a.title);
    expect(titles).toContain('Activity outside business hours');
    expect(titles).toContain('3 stock removals by till in one day');
  });

  it('flags a large removal and a quantity edited outside the app', async () => {
    const p = await createProduct(owner, { code: 'B1', name: 'Battery', category: 'Auto', unit: 'each', priceNgwee: 235000, costNgwee: null, quantity: 4, reorderLevel: 1 });
    await adjustStock(owner, p.id, -1, 'Damaged');
    await db.products.update(p.id, { quantity: 10 });
    const titles = (await computeAlerts()).map((a) => a.title);
    expect(titles).toContain('Large stock removal by owner');
    expect(titles).toContain('Stock for Battery does not match its history');
  });
});
