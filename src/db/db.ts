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
}

export interface ActivityEntry extends SyncFields {
  at: string;
  userId: string;
  username: string;
  role: Role;
  action: string;
  details: string;
}

export interface Setting {
  key: string;
  value: string;
}

export class PosDatabase extends Dexie {
  users!: EntityTable<User, 'id'>;
  activity!: EntityTable<ActivityEntry, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'patience-pos') {
    super(name);
    this.version(1).stores({
      users: 'id, &username, role, active, syncState',
      activity: 'id, at, userId, role, action, syncState',
      settings: 'key',
    });
  }
}

export const db = new PosDatabase();

export function newRecord(): SyncFields {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, syncState: 'pending' };
}
