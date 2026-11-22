import { db, newRecord, type Role, type User } from '../db/db';
import { hashPassword, passwordProblem, verifyPassword } from '../auth/password';
import { canManageRole, ROLE_LABEL } from '../auth/permissions';
import { logActivity } from './activity';

export class UserError extends Error {}

export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase();
}

function checkUsername(username: string) {
  if (!/^[a-z0-9._-]{3,30}$/.test(username))
    throw new UserError('Username must be 3 to 30 letters, numbers, dots, dashes or underscores.');
}

export async function hasOwner(): Promise<boolean> {
  return (await db.users.where('role').equals('owner').count()) > 0;
}

export async function createOwner(input: { username: string; fullName: string; password: string }): Promise<User> {
  // Hash before opening the transaction: IndexedDB transactions close if they wait on WebCrypto.
  const user = await prepareUser({ ...input, role: 'owner' }, null);
  return db.transaction('rw', db.users, db.activity, async () => {
    if (await hasOwner()) throw new UserError('An owner account already exists.');
    await addUser(user);
    await logActivity(user, 'Owner account created', user.fullName);
    return user;
  });
}

async function prepareUser(
  input: { username: string; fullName: string; password: string; role: Role },
  createdBy: string | null,
): Promise<User> {
  const username = normaliseUsername(input.username);
  checkUsername(username);
  if (!input.fullName.trim()) throw new UserError('Enter the full name.');
  const problem = passwordProblem(input.password);
  if (problem) throw new UserError(problem);
  const { hash, salt } = await hashPassword(input.password);
  return {
    ...newRecord(),
    username,
    fullName: input.fullName.trim(),
    role: input.role,
    passwordHash: hash,
    passwordSalt: salt,
    active: true,
    createdBy,
  };
}

async function addUser(user: User) {
  if (await db.users.where('username').equals(user.username).count())
    throw new UserError(`The username "${user.username}" is already taken.`);
  await db.users.add(user);
}

export async function createUser(
  actor: User,
  input: { username: string; fullName: string; password: string; role: Role },
): Promise<User> {
  if (!canManageRole(actor.role, input.role))
    throw new UserError(`A ${ROLE_LABEL[actor.role].toLowerCase()} cannot create ${input.role} accounts.`);
  const user = await prepareUser(input, actor.id);
  await addUser(user);
  await logActivity(actor, 'User created', `${user.fullName} (${user.username}) as ${ROLE_LABEL[user.role]}`);
  return user;
}

async function loadManageable(actor: User, userId: string): Promise<User> {
  const target = await db.users.get(userId);
  if (!target) throw new UserError('User not found.');
  if (!canManageRole(actor.role, target.role)) throw new UserError('You are not allowed to change this account.');
  return target;
}

export async function setUserActive(actor: User, userId: string, active: boolean) {
  const target = await loadManageable(actor, userId);
  await db.users.update(userId, { active, updatedAt: new Date().toISOString(), syncState: 'pending' });
  await logActivity(actor, active ? 'User reactivated' : 'User deactivated', `${target.fullName} (${target.username})`);
}

export async function resetPassword(actor: User, userId: string, newPassword: string) {
  const target = await loadManageable(actor, userId);
  const problem = passwordProblem(newPassword);
  if (problem) throw new UserError(problem);
  const { hash, salt } = await hashPassword(newPassword);
  await db.users.update(userId, {
    passwordHash: hash,
    passwordSalt: salt,
    updatedAt: new Date().toISOString(),
    syncState: 'pending',
  });
  await logActivity(actor, 'Password reset', `${target.fullName} (${target.username})`);
}

export async function changeOwnPassword(actor: User, current: string, next: string) {
  if (!(await verifyPassword(current, actor.passwordHash, actor.passwordSalt)))
    throw new UserError('Your current password is wrong.');
  const problem = passwordProblem(next);
  if (problem) throw new UserError(problem);
  const { hash, salt } = await hashPassword(next);
  await db.users.update(actor.id, {
    passwordHash: hash,
    passwordSalt: salt,
    updatedAt: new Date().toISOString(),
    syncState: 'pending',
  });
  await logActivity(actor, 'Changed own password');
}

/** Returns the user on success, or null. Failed attempts are logged against the account when it exists. */
export async function authenticate(username: string, password: string): Promise<User | null> {
  const user = await db.users.where('username').equals(normaliseUsername(username)).first();
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!ok) {
    await logActivity(user, 'Failed sign-in attempt');
    return null;
  }
  if (!user.active) {
    await logActivity(user, 'Blocked sign-in (account deactivated)');
    return null;
  }
  await logActivity(user, 'Signed in');
  return user;
}
