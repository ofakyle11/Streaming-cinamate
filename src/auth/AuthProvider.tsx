import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { services } from '../services';
import type { AdapterMode, AuthService, OAuthProvider, User } from '../services/types';
import { AuthContext, type AuthContextValue, type AuthStatus } from './context';
import { clearLocalData } from './localData';

export interface AuthProviderProps {
  children?: ReactNode;
  /** Override the auth adapter (tests, storybook). Defaults to the service locator's. */
  service?: AuthService;
  mode?: AdapterMode;
  /** Override the local wipe (tests). */
  clearLocal?: () => void;
}

/**
 * Tracks the current session and exposes auth actions. Starts in `loading`,
 * then resolves to `authenticated` or `guest`. Adapter failures resolve to
 * guest mode rather than breaking the app.
 */
export default function AuthProvider({
  children,
  service = services.auth,
  mode = services.mode.auth,
  clearLocal = clearLocalData,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let active = true;
    const apply = (u: User | null) => {
      if (!active) return;
      setUser(u);
      setStatus(u ? 'authenticated' : 'guest');
    };

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = service.onAuthStateChange(apply);
    } catch {
      /* adapter unavailable: guest mode */
    }
    service
      .currentUser()
      .then(apply)
      .catch(() => apply(null));

    return () => {
      active = false;
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
    };
  }, [service]);

  const signInWithMagicLink = useCallback((email: string) => service.signInWithMagicLink(email), [service]);
  const signInWithOAuth = useCallback((p: OAuthProvider) => service.signInWithOAuth(p), [service]);

  const signOut = useCallback(async () => {
    await service.signOut();
    setUser(null);
    setStatus('guest');
  }, [service]);

  const deleteData = useCallback(async () => {
    // Server-side first so a failure leaves local data intact and the user can retry.
    if (user) await service.requestDataDeletion();
    clearLocal();
    setUser(null);
    setStatus('guest');
  }, [service, user, clearLocal]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isGuest: status !== 'authenticated',
      mode,
      signInWithMagicLink,
      signInWithOAuth,
      signOut,
      deleteData,
    }),
    [status, user, mode, signInWithMagicLink, signInWithOAuth, signOut, deleteData],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
