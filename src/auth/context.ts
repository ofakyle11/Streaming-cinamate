import { createContext, useContext } from 'react';
import type { AdapterMode, AuthCallbackParams, MagicLinkOptions, OAuthProvider, User } from '../services/types';

/** `guest` is the default: the whole app works without an account. */
export type AuthStatus = 'loading' | 'guest' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  isGuest: boolean;
  /** Whether auth is backed by Supabase or the local demo adapter. */
  mode: AdapterMode;
  /** Live: sends an email. Mock: signs in immediately. */
  signInWithMagicLink(email: string, options?: MagicLinkOptions): Promise<void>;
  signInWithOAuth(provider: OAuthProvider): Promise<void>;
  /**
   * Finishes a magic link / OAuth return from the params /auth/callback captured
   * (see src/auth/callbackBoot.ts). Marks the user signed in before resolving,
   * so the page can navigate without a guest flash. Rejects with fixed copy.
   */
  completeSignIn(params: AuthCallbackParams): Promise<User>;
  signOut(): Promise<void>;
  /** Deletes account data (server side when signed in) and all local device data. */
  deleteData(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Like useAuth, but null outside <AuthProvider> (for components that also
 * render in isolation, such as the navbar in its own tests).
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
