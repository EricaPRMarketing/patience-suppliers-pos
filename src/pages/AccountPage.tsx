import { useState, type FormEvent } from 'react';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { ROLE_LABEL } from '../auth/permissions';
import { changeOwnPassword, UserError } from '../lib/users';

export function AccountPage() {
  const user = useCurrentUser();
  const { refresh } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await changeOwnPassword(user, current, next);
      await refresh();
      setCurrent('');
      setNext('');
      setMsg('Your password has been changed.');
    } catch (err) {
      setError(err instanceof UserError ? err.message : 'Could not change the password.');
    }
  }

  return (
    <>
      <h1>My account</h1>
      <div className="card">
        <p>
          <strong>{user.fullName}</strong> ({user.username}) · {ROLE_LABEL[user.role]}
        </p>
      </div>
      <form className="card form-grid" onSubmit={submit}>
        <h2>Change password</h2>
        <label>
          Current password
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label>
          New password
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </label>
        {msg && <p className="notice">{msg}</p>}
        {error && <p className="error">{error}</p>}
        <button type="submit">Change password</button>
      </form>
    </>
  );
}
