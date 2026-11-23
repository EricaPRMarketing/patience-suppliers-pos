import { db, newRecord, type ActivityEntry, type User } from '../db/db';
import { sha256Hex } from './sha256';

export const GENESIS = 'patience-suppliers-pos';
const HIGH_WATER = 'log.highestSeq';

export function entryHash(e: Omit<ActivityEntry, 'hash' | 'syncState' | 'updatedAt'>): string {
  return sha256Hex(
    [e.prevHash, e.seq, e.id, e.at, e.userId, e.username, e.role, e.action, e.details, JSON.stringify(e.meta ?? {})].join(
      '␟',
    ),
  );
}

/**
 * Appends to the activity log. Each entry carries the hash of the one before it, so editing or deleting an
 * entry breaks the chain and shows up on the owner's Security page.
 */
export async function logActivity(
  actor: Pick<User, 'id' | 'username' | 'role'>,
  action: string,
  details = '',
  meta?: Record<string, string | number>,
) {
  await db.transaction('rw', db.activity, db.settings, async () => {
    const last = await db.activity.orderBy('seq').last();
    const rec = newRecord();
    const seq = (last?.seq ?? 0) + 1;
    const entry: ActivityEntry = {
      ...rec,
      at: rec.createdAt,
      userId: actor.id,
      username: actor.username,
      role: actor.role,
      action,
      details,
      ...(meta ? { meta } : {}),
      seq,
      prevHash: last?.hash ?? GENESIS,
    };
    entry.hash = entryHash(entry);
    await db.activity.add(entry);
    await db.settings.put({ key: HIGH_WATER, value: String(seq) });
  });
}

export interface LogCheck {
  ok: boolean;
  checked: number;
  problems: { seq: number; at?: string; problem: string }[];
}

/** Re-computes the chain. Finds edited entries, deleted entries and a log that was cut short. */
export async function verifyActivityLog(): Promise<LogCheck> {
  const entries = (await db.activity.orderBy('seq').toArray()).filter((e) => e.seq != null);
  const problems: LogCheck['problems'] = [];
  let expectedSeq = 1;
  let prevHash = GENESIS;
  for (const e of entries) {
    if (e.seq! !== expectedSeq)
      problems.push({
        seq: expectedSeq,
        problem:
          e.seq! > expectedSeq
            ? `${e.seq! - expectedSeq} log entr${e.seq! - expectedSeq === 1 ? 'y was' : 'ies were'} deleted before entry ${e.seq}`
            : `Entry ${e.seq} appears twice`,
      });
    else if (e.prevHash !== prevHash)
      problems.push({ seq: e.seq!, at: e.at, problem: `Entry ${e.seq} does not follow the entry before it` });
    if (entryHash(e) !== e.hash)
      problems.push({ seq: e.seq!, at: e.at, problem: `Entry ${e.seq} (${e.action} by ${e.username}) was changed after it was written` });
    expectedSeq = e.seq! + 1;
    prevHash = e.hash ?? '';
  }
  const highest = Number((await db.settings.get(HIGH_WATER))?.value ?? 0);
  const lastSeq = entries.length ? entries[entries.length - 1].seq! : 0;
  if (highest > lastSeq)
    problems.push({ seq: lastSeq + 1, problem: `The newest ${highest - lastSeq} log entries were deleted` });
  return { ok: problems.length === 0, checked: entries.length, problems };
}
