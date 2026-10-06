import type { AuthContextValue } from '../../auth/context';

/**
 * The account-area view of useAuth(). The devices list, sign-out scope and
 * change-email calls come from the auth layer (src/auth); they stay optional
 * here so a context without them (tests, a reduced adapter) still renders the
 * local-only state instead of promising features it cannot deliver.
 */
export interface Device {
  id: string;
  label: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  /** The browser this page is open in. */
  current: boolean;
}

export type SignOutScope = 'local' | 'global';

export interface AccountAuth {
  /**
   * `'global'` signs out everywhere (revokes every refresh token and every
   * other device row). With no option both adapters sign out this browser only.
   */
  signOut(options?: { scope?: SignOutScope }): Promise<void>;
  /** Newest-seen first. Mock returns this browser as the only device. */
  listDevices?: () => Promise<Device[]>;
  /** Marks the row revoked; that browser signs out on its next check. Forgetting the current device equals a local sign-out. */
  forgetDevice?: (deviceId: string) => Promise<void>;
  /** A confirmation goes to both the old and the new address. */
  changeEmail?: (newEmail: string) => Promise<void>;
  /**
   * Whether `signOut({ scope: 'global' })` is honoured. The scope option
   * ships together with the devices list, so its presence is the signal;
   * without it, "sign out everywhere" is hidden rather than shown as a
   * button that would only sign out this device.
   */
  canSignOutEverywhere: boolean;
}

/** Reads the optional account methods off whatever useAuth() currently returns. */
export function accountAuth(auth: AuthContextValue): AccountAuth {
  // Widening, not a cast: a `() => Promise<void>` is assignable to the optional-options shape.
  const a: AuthContextValue & Partial<Omit<AccountAuth, 'signOut' | 'canSignOutEverywhere'>> = auth;
  const signOut: AccountAuth['signOut'] = a.signOut;
  return {
    signOut: (options) => signOut.call(a, options),
    listDevices: typeof a.listDevices === 'function' ? () => a.listDevices!() : undefined,
    forgetDevice: typeof a.forgetDevice === 'function' ? (id) => a.forgetDevice!(id) : undefined,
    changeEmail: typeof a.changeEmail === 'function' ? (email) => a.changeEmail!(email) : undefined,
    canSignOutEverywhere: typeof a.listDevices === 'function',
  };
}
