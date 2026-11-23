import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOwner, UserError } from '../lib/users';
import { useAuth } from '../auth/AuthContext';
import { Letterhead } from '../components/Letterhead';
import { IS_PREVIEW } from '../lib/paths';
import { seedDemo } from '../lib/demo';

export function SetupPage({ onDone }: { onDone: () => void }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    try {
      await createOwner({ fullName, username, password });
      onDone();
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof UserError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <Letterhead />
        {IS_PREVIEW && (
          <div className="demo-box">
            <strong>Preview link</strong>
            <p className="muted small">
              Load example accounts, stock, quotations and invoices to look around. Everything stays in this browser only.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await seedDemo();
                onDone();
                await login('owner', 'Siavonga2026');
                navigate('/');
              }}
            >
              {busy ? 'Loading…' : 'Open the demo'}
            </button>
          </div>
        )}
        <h1>Set up the owner account</h1>
        <p className="muted">
          This is the first time the app has been opened on this device. The owner account can see everything and
          creates the manager and staff logins.
        </p>
        <label>
          Full name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" required />
        </label>
        <p className="muted small">At least 8 characters, with letters and numbers.</p>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label>
          Confirm password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create owner account'}
        </button>
      </form>
    </div>
  );
}
