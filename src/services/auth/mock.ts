import type { AuthService, OAuthProvider, User } from '../types';
import { requireEmail, requirePassword } from './validate';

/** localStorage key holding the fake session. */
export const MOCK_SESSION_KEY = 'lf.mock.auth.session';
/** Pre-session key from Wave 0 (a bare User); migrated on first read. */
const LEGACY_USER_KEY = 'lf.mock.auth.user';
/** Key used by the mock DB adapter; wiped by requestDataDeletion. */
const MOCK_DB_KEY = 'lf.mock.db';
/** Fake sessions last a week, like a long-lived refresh token. */
export const MOCK_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface MockSession {
  user: User;
  /** Opaque fake token so the shape resembles a real session. Never sent anywhere. */
  accessToken: string;
  /** Epoch ms. */
  expiresAt: number;
}

export interface MockAuthOptions {
  /** Injectable clock for tests. */
  now?: () => number;
  /** Injectable storage for tests; defaults to window.localStorage when available. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
}

function defaultStorage(): MockAuthOptions['storage'] {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // access can throw when site data is blocked
  }
}

function isUser(v: unknown): v is User {
  if (!v || typeof v !== 'object') return false;
  const u = v as Record<string, unknown>;
  return typeof u.id === 'string' && typeof u.email === 'string' && typeof u.displayName === 'string';
}

function isSession(v: unknown): v is MockSession {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return isUser(s.user) && typeof s.accessToken === 'string' && typeof s.expiresAt === 'number';
}

function randomToken(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `mock.${crypto.randomUUID()}`;
  } catch {
    /* fall through */
  }
  return `mock.${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`;
}

export function makeMockUser(email: string, displayName?: string, now = Date.now()): User {
  const handle = email.split('@')[0] || 'viewer';
  return {
    id: `mock-${handle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    email,
    displayName: displayName?.trim() || handle,
    createdAt: new Date(now).toISOString(),
  };
}

const MOCK_OAUTH_USERS: Record<OAuthProvider, { email: string; name: string }> = {
  google: { email: 'demo.viewer@gmail.com', name: 'Demo Viewer' },
};

/**
 * Fake auth for demo / offline use: the "session" lives in localStorage and no
 * network request is ever made. Magic links and OAuth sign in immediately.
 */
export function createMockAuth(opts: MockAuthOptions = {}): AuthService {
  const now = opts.now ?? Date.now;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;

  const read = (): MockSession | null => {
    try {
      const raw = storage?.getItem(MOCK_SESSION_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        return isSession(parsed) ? parsed : null;
      }
      // Migrate the Wave 0 bare-user format.
      const legacy = storage?.getItem(LEGACY_USER_KEY);
      if (legacy) {
        storage?.removeItem(LEGACY_USER_KEY);
        const parsed: unknown = JSON.parse(legacy);
        if (isUser(parsed)) {
          const migrated = { user: parsed, accessToken: randomToken(), expiresAt: now() + MOCK_SESSION_TTL_MS };
          write(migrated);
          return migrated;
        }
      }
    } catch {
      /* corrupt JSON or unavailable storage: treat as signed out */
    }
    return null;
  };

  const write = (s: MockSession | null) => {
    try {
      if (s) storage?.setItem(MOCK_SESSION_KEY, JSON.stringify(s));
      else storage?.removeItem(MOCK_SESSION_KEY);
    } catch {
      /* storage unavailable (private mode) – keep in-memory only */
    }
  };

  let session: MockSession | null = read();
  const listeners = new Set<(u: User | null) => void>();

  const activeUser = (): User | null => {
    if (session && session.expiresAt <= now()) {
      session = null;
      write(null);
    }
    return session?.user ?? null;
  };

  const set = (user: User | null) => {
    session = user ? { user, accessToken: randomToken(), expiresAt: now() + MOCK_SESSION_TTL_MS } : null;
    write(session);
    const current = activeUser();
    listeners.forEach((cb) => cb(current));
  };

  // Keep tabs in sync, like Supabase does via its own storage listener.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (e) => {
      if (e.key !== MOCK_SESSION_KEY) return;
      session = read();
      const current = activeUser();
      listeners.forEach((cb) => cb(current));
    });
  }

  return {
    async currentUser() {
      return activeUser();
    },
    async signInWithEmail(email, password) {
      const normalized = requireEmail(email);
      requirePassword(password);
      const u = makeMockUser(normalized, undefined, now());
      set(u);
      return u;
    },
    async signUpWithEmail(email, password, displayName) {
      const normalized = requireEmail(email);
      requirePassword(password);
      const u = makeMockUser(normalized, displayName, now());
      set(u);
      return u;
    },
    async signInWithMagicLink(email) {
      // Mock: "click" the link immediately.
      set(makeMockUser(requireEmail(email), undefined, now()));
    },
    async completeSignIn(params) {
      // Mock sign-in completes immediately, so a callback only confirms it.
      if (params.error || params.error_code) throw new Error('This sign-in link has expired or was already used. Request a new one.');
      const user = activeUser();
      if (!user) throw new Error('This sign-in link has expired or was already used. Request a new one.');
      return user;
    },
    async signInWithOAuth(provider) {
      const demo = MOCK_OAUTH_USERS[provider];
      if (!demo) throw new Error(`Unsupported sign-in provider: ${String(provider)}`);
      set(makeMockUser(demo.email, demo.name, now()));
    },
    async signOut() {
      set(null);
    },
    async requestDataDeletion() {
      try {
        storage?.removeItem(MOCK_DB_KEY);
      } catch {
        /* nothing stored */
      }
      set(null);
    },
    onAuthStateChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
