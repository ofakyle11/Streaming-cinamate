import type { AuthService, User } from '../types';

const STORAGE_KEY = 'lf.mock.auth.user';

function safeRead(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function safeWrite(user: User | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode, SSR) – keep in-memory only */
  }
}

function makeUser(email: string, displayName?: string): User {
  const handle = email.split('@')[0] || 'viewer';
  return {
    id: `mock-${handle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    email,
    displayName: displayName?.trim() || handle,
    avatarUrl: `https://picsum.photos/seed/avatar-${encodeURIComponent(handle)}/96/96`,
    createdAt: new Date().toISOString(),
  };
}

/** In-memory + localStorage auth. Accepts any email / password of 4+ chars. */
export function createMockAuth(): AuthService {
  let user: User | null = safeRead();
  const listeners = new Set<(u: User | null) => void>();
  const emit = () => listeners.forEach((cb) => cb(user));
  const set = (u: User | null) => {
    user = u;
    safeWrite(u);
    emit();
  };

  return {
    async currentUser() {
      return user;
    },
    async signInWithEmail(email, password) {
      if (!email.includes('@')) throw new Error('Enter a valid email address.');
      if (password.length < 4) throw new Error('Password must be at least 4 characters.');
      const u = makeUser(email);
      set(u);
      return u;
    },
    async signUpWithEmail(email, password, displayName) {
      if (!email.includes('@')) throw new Error('Enter a valid email address.');
      if (password.length < 4) throw new Error('Password must be at least 4 characters.');
      const u = makeUser(email, displayName);
      set(u);
      return u;
    },
    async signInWithMagicLink(email) {
      if (!email.includes('@')) throw new Error('Enter a valid email address.');
      // Mock: "click" the link immediately.
      set(makeUser(email));
    },
    async signOut() {
      set(null);
    },
    onAuthStateChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
