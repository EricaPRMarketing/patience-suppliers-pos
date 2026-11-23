import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Letterhead } from '../components/Letterhead';
import { useOnline } from '../lib/useOnline';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await login(username, password);
    setBusy(false);
    if (r.ok) return navigate('/');
    setPassword('');
    if (r.reason === 'locked')
      setError(
        `Too many wrong passwords. This account is locked until ${new Date(r.until).toLocaleTimeString('en-ZM', { hour: '2-digit', minute: '2-digit' })}. The owner or a manager can unlock it sooner.`,
      );
    else setError('Wrong username or password, or the account has been deactivated.');
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <Letterhead />
        <h1>Sign in</h1>
        {!online && <p className="pill warn">You are offline. You can still sign in and work.</p>}
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
