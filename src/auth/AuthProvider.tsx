import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readSyncOwner, services, startCloudSync, type CloudSync } from '../services';
import { useLastFrameStore } from '../state/store';
import type {
  AdapterMode,
  AuthCallbackParams,
  AuthService,
  MagicLinkOptions,
  OAuthProvider,
  User,
} from '../services/types';
import { AuthContext, type AuthContextValue, type AuthStatus } from './context';
import { clearLocalData, resetSyncedData } from './localData';
import { clearImageCache } from '../pwa/imageCache';

export interface AuthProviderProps {
  children?: ReactNode;
  /** Override the auth adapter (tests, storybook). Defaults to the service locator's. */
  service?: AuthService;
  mode?: AdapterMode;
  /** Override the local wipe (tests). */
  clearLocal?: () => void;
  /**
   * Starts store <-> cloud sync for a signed-in user (tests may stub it; null
   * disables sync). The default is a no-op against the mock DB adapter.
   */
  startSync?: ((userId: string) => CloudSync) | null;
  /**
   * Resets the account's synced data on this device after sign-out (tests).
   * Only runs when the store holds cloud data, so it never leaks to the next
   * guest or account; with the mock DB (no cloud copy) local data is kept.
   */
  resetSynced?: () => void;
}

/** Default: sync the app store through the active DB adapter. */
const defaultStartSync = (userId: string): CloudSync =>
  startCloudSync(userId, { db: services.db, store: useLastFrameStore });

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
  startSync = defaultStartSync,
  resetSynced = resetSyncedData,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const syncRef = useRef<CloudSync | null>(null);
  const userId = user?.id ?? null;
  // Bumped to restart sync after it was stopped for an action that then failed.
  const [syncEpoch, setSyncEpoch] = useState(0);

  // Cloud sync runs while a user is signed in (initial pull, then debounced upserts).
  useEffect(() => {
    void syncEpoch;
    if (!userId || !startSync) return;
    let handle: CloudSync | null = null;
    try {
      handle = startSync(userId);
    } catch {
      handle = null; // sync is best effort; the local store keeps working
    }
    syncRef.current = handle;
    return () => {
      if (syncRef.current === handle) syncRef.current = null;
      void handle?.stop().catch(() => undefined);
    };
  }, [userId, startSync, syncEpoch]);

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

  const signInWithMagicLink = useCallback(
    (email: string, options?: MagicLinkOptions) =>
      options ? service.signInWithMagicLink(email, options) : service.signInWithMagicLink(email),
    [service],
  );
  const signInWithOAuth = useCallback((p: OAuthProvider) => service.signInWithOAuth(p), [service]);
  const completeSignIn = useCallback(
    async (params: AuthCallbackParams) => {
      const u = await service.completeSignIn(params);
      setUser(u);
      setStatus('authenticated');
      return u;
    },
    [service],
  );

  const signOut = useCallback(async () => {
    const sync = syncRef.current;
    syncRef.current = null;
    // Upload unsent edits while the session is still valid, then stop syncing
    // so resetting the local data below is not uploaded as deletions.
    await sync?.flush().catch(() => undefined);
    await sync?.stop({ flush: false }).catch(() => undefined);
    const holdsCloudData = !!sync?.linked || (!!userId && readSyncOwner() === userId);
    try {
      await service.signOut();
    } catch (err) {
      if (sync) setSyncEpoch((n) => n + 1); // still signed in: resume syncing
      throw err;
    }
    // The account's data lives in the cloud; drop the device copy so the next
    // guest or account never sees (or uploads) it.
    if (holdsCloudData) resetSynced();
    setUser(null);
    setStatus('guest');
  }, [service, userId, resetSynced]);

  const deleteData = useCallback(async () => {
    // Stop sync and forget its queue first: nothing more should be uploaded for
    // an account being erased, and the local wipe must not sync as deletions.
    const sync = syncRef.current;
    syncRef.current = null;
    await sync?.stop({ discard: true }).catch(() => undefined);
    // Server-side next so a failure leaves local data intact and the user can retry.
    try {
      if (user) await service.requestDataDeletion();
    } catch (err) {
      if (sync) setSyncEpoch((n) => n + 1); // still signed in: resume syncing
      throw err;
    }
    clearLocal();
    setUser(null);
    setStatus('guest');
    // Cached posters/backdrops would reveal what was browsed or watched.
    // clearImageCache never rejects, so this cannot fail the deletion.
    await clearImageCache();
  }, [service, user, clearLocal]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isGuest: status !== 'authenticated',
      mode,
      signInWithMagicLink,
      signInWithOAuth,
      completeSignIn,
      signOut,
      deleteData,
    }),
    [status, user, mode, signInWithMagicLink, signInWithOAuth, completeSignIn, signOut, deleteData],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
