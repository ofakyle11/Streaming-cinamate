import type { AuthContextValue } from '../../auth/context';

/**
 * The account-area view of useAuth(). The devices list, sign-out scope and
 * change-email calls arrive with the Supabase backend thread (T3); until that
 * merges they are optional here, and the page shows the local-only state when
 * they are missing. Shapes match T3's contract exactly so nothing changes
 * when it lands.
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
  /** `'global'` signs out everywhere (revokes every refresh token). Default is this device. */
  signOut(options?: { scope?: SignOutScope }): Promise<void>;
  /** Newest-seen first. Mock returns this browser as the only device. */
  listDevices?: () => Promise<Device[]>;
  /** Marks the row revoked; that browser signs out on its next check. Forgetting the current device equals a local sign-out. */
  forgetDevice?: (deviceId: string) => Promise<void>;
  /** A confirmation goes to both the old and the new address. */
  changeEmail?: (newEmail: string) => Promise<void>;
}

/** Reads the optional account methods off whatever useAuth() currently returns. */
export function accountAuth(auth: AuthContextValue): AccountAuth {
  const a = auth as AuthContextValue & Partial<AccountAuth>;
  return {
    signOut: (options) => (a.signOut as AccountAuth['signOut'])(options),
    listDevices: typeof a.listDevices === 'function' ? () => a.listDevices!() : undefined,
    forgetDevice: typeof a.forgetDevice === 'function' ? (id) => a.forgetDevice!(id) : undefined,
    changeEmail: typeof a.changeEmail === 'function' ? (email) => a.changeEmail!(email) : undefined,
  };
}
