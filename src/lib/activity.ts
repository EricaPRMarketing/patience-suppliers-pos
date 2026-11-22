import { db, newRecord, type User } from '../db/db';

export async function logActivity(actor: Pick<User, 'id' | 'username' | 'role'>, action: string, details = '') {
  const rec = newRecord();
  await db.activity.add({
    ...rec,
    at: rec.createdAt,
    userId: actor.id,
    username: actor.username,
    role: actor.role,
    action,
    details,
  });
}
