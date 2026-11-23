import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { db, type User } from '../db/db';
import { signIn, type SignInResult } from '../lib/users';
import { logActivity } from '../lib/activity';

const SESSION_KEY = 'pos.session';
const SESSION_HOURS = 12;
/** Sign out automatically after this long with no taps, clicks or typing. */
export const IDLE_MINUTES = 15;

interface Session {
  userId: string;
  expires: number;
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.expires > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: session lasts until the tab closes */
  }
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<SignInResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = readSession();
    const u = s ? await db.users.get(s.userId) : undefined;
    if (u && u.active) setUser(u);
    else {
      writeSession(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const r = await signIn(username, password);
    if (r.ok) {
      writeSession({ userId: r.user.id, expires: Date.now() + SESSION_HOURS * 3600_000 });
      setUser(r.user);
    }
    return r;
  }, []);

  const logout = useCallback(async () => {
    if (user) await logActivity(user, 'Signed out');
    writeSession(null);
    setUser(null);
  }, [user]);

  // Automatic sign-out when the till is left unattended.
  useEffect(() => {
    if (!user) return;
    let last = Date.now();
    const touch = () => (last = Date.now());
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(async () => {
      if (Date.now() - last > IDLE_MINUTES * 60_000) {
        await logActivity(user, 'Signed out automatically', `No activity for ${IDLE_MINUTES} minutes`);
        writeSession(null);
        setUser(null);
      }
    }, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
    };
  }, [user]);

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** For pages behind RequireAuth, where a user is guaranteed. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('No signed-in user');
  return user;
}
