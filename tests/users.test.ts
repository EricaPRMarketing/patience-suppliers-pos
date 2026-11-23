import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import {
  authenticate,
  createOwner,
  createUser,
  resetPassword,
  setUserActive,
  UserError,
} from '../src/lib/users';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('accounts', () => {
  it('creates exactly one owner', async () => {
    await createOwner({ username: 'Owner', fullName: 'Owner Person', password: 'secret12' });
    await expect(createOwner({ username: 'other', fullName: 'X', password: 'secret12' })).rejects.toBeInstanceOf(
      UserError,
    );
  });

  it('signs in with the right password only, case-insensitive username', async () => {
    await createOwner({ username: 'owner', fullName: 'Owner', password: 'secret12' });
    expect(await authenticate('OWNER', 'secret12')).not.toBeNull();
    expect(await authenticate('owner', 'wrong123')).toBeNull();
  });

  it('enforces who can create and manage accounts, and logs it', async () => {
    const owner = await createOwner({ username: 'owner', fullName: 'Owner', password: 'secret12' });
    const manager = await createUser(owner, { username: 'mgr', fullName: 'Manager', password: 'secret12', role: 'manager' });
    const staff = await createUser(manager, { username: 'till1', fullName: 'Till One', password: 'secret12', role: 'staff' });
    await expect(
      createUser(manager, { username: 'mgr2', fullName: 'M2', password: 'secret12', role: 'manager' }),
    ).rejects.toBeInstanceOf(UserError);
    await expect(
      createUser(staff, { username: 'till2', fullName: 'T2', password: 'secret12', role: 'staff' }),
    ).rejects.toBeInstanceOf(UserError);
    await expect(setUserActive(manager, owner.id, false)).rejects.toBeInstanceOf(UserError);

    const actions = (await db.activity.toArray()).map((a) => `${a.username}:${a.action}`);
    expect(actions).toContain('owner:User created');
    expect(actions).toContain('mgr:User created');
  });

  it('blocks deactivated users and lets a reset password work', async () => {
    const owner = await createOwner({ username: 'owner', fullName: 'Owner', password: 'secret12' });
    const staff = await createUser(owner, { username: 'till1', fullName: 'Till', password: 'secret12', role: 'staff' });
    await setUserActive(owner, staff.id, false);
    expect(await authenticate('till1', 'secret12')).toBeNull();
    await setUserActive(owner, staff.id, true);
    await resetPassword(owner, staff.id, 'newpass1');
    expect(await authenticate('till1', 'secret12')).toBeNull();
    expect(await authenticate('till1', 'newpass1')).not.toBeNull();
  });

  it('rejects duplicate usernames and short passwords', async () => {
    const owner = await createOwner({ username: 'owner', fullName: 'Owner', password: 'secret12' });
    await expect(
      createUser(owner, { username: 'OWNER', fullName: 'Dup', password: 'secret12', role: 'staff' }),
    ).rejects.toThrow(/already taken/);
    await expect(
      createUser(owner, { username: 'shorty', fullName: 'S', password: '123', role: 'staff' }),
    ).rejects.toThrow(/at least 8/);
  });
});
