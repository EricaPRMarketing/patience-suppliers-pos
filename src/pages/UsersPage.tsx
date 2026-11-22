import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Role, type User } from '../db/db';
import { useCurrentUser } from '../auth/AuthContext';
import { canManageRole, ROLE_LABEL } from '../auth/permissions';
import { createUser, resetPassword, setUserActive, UserError } from '../lib/users';

export function UsersPage() {
  const actor = useCurrentUser();
  const users = useLiveQuery(() => db.users.orderBy('username').toArray(), []);
  const creatable: Role[] = (['manager', 'staff'] as Role[]).filter((r) => canManageRole(actor.role, r));
  const [message, setMessage] = useState('');

  return (
    <>
      <h1>Users</h1>
      {message && <p className="notice">{message}</p>}
      {creatable.length > 0 && <NewUserForm actor={actor} roles={creatable} onDone={setMessage} />}
      <section className="card">
        <h2>All accounts</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <UserRow key={u.id} actor={actor} user={u} onMessage={setMessage} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function UserRow({ actor, user, onMessage }: { actor: User; user: User; onMessage: (m: string) => void }) {
  const manageable = canManageRole(actor.role, user.role);
  async function toggle() {
    try {
      await setUserActive(actor, user.id, !user.active);
      onMessage(`${user.fullName} is now ${user.active ? 'deactivated' : 'active'}.`);
    } catch (e) {
      onMessage(e instanceof UserError ? e.message : 'Could not update the account.');
    }
  }
  async function reset() {
    const pw = window.prompt(`New password for ${user.fullName} (at least 6 characters):`);
    if (!pw) return;
    try {
      await resetPassword(actor, user.id, pw);
      onMessage(`Password reset for ${user.fullName}.`);
    } catch (e) {
      onMessage(e instanceof UserError ? e.message : 'Could not reset the password.');
    }
  }
  return (
    <tr className={user.active ? '' : 'inactive'}>
      <td>{user.fullName}</td>
      <td>{user.username}</td>
      <td>
        <span className={`role role-${user.role}`}>{ROLE_LABEL[user.role]}</span>
      </td>
      <td>{user.active ? 'Active' : 'Deactivated'}</td>
      <td className="actions">
        {manageable && (
          <>
            <button className="ghost" onClick={reset}>
              Reset password
            </button>
            <button className="ghost" onClick={toggle}>
              {user.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

function NewUserForm({ actor, roles, onDone }: { actor: User; roles: Role[]; onDone: (m: string) => void }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(roles[roles.length - 1]);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const u = await createUser(actor, { fullName, username, password, role });
      onDone(`${u.fullName} can now sign in as "${u.username}".`);
      setFullName('');
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err instanceof UserError ? err.message : 'Could not create the account.');
    }
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2>Add a user</h2>
      <label>
        Full name
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </label>
      <label>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" required />
      </label>
      <label>
        Starting password
        <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit">Add user</button>
    </form>
  );
}
