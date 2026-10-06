/**
 * Device identity for the "where you are signed in" list (public.devices).
 *
 * A device is a browser profile: a random id minted on first use and kept in
 * localStorage for the life of the sign-in. It is forgotten on sign-out, so two
 * accounts used from one browser never share an id (nothing in the database
 * links them). It is not a fingerprint and never leaves the project.
 */

/** localStorage key holding this browser's device id. Wiped by clearLocalData (lf.* prefix). */
export const DEVICE_ID_KEY = 'lf.device';
/** Table name (see supabase/migrations/20261006000000_devices.sql). */
export const DEVICES_TABLE = 'devices';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // access can throw when site data is blocked
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

const ID_RE = /^[A-Za-z0-9-]{8,64}$/;

// Private-mode fallback: one id for the lifetime of the page.
let memoryId: string | null = null;

/** This browser's device id, created on first use. */
export function currentDeviceId(storage: StorageLike | null = defaultStorage()): string {
  if (!storage) return (memoryId ??= randomId());
  try {
    const existing = storage.getItem(DEVICE_ID_KEY);
    if (existing && ID_RE.test(existing)) return existing;
    const fresh = randomId();
    storage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    memoryId ??= randomId();
    return memoryId;
  }
}

/** Drop this browser's device id (on sign-out), so the next sign-in mints a new one. */
export function forgetDeviceId(storage: StorageLike | null = defaultStorage()): void {
  memoryId = null;
  try {
    storage?.removeItem(DEVICE_ID_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** The user agent string, trimmed to the column limit. */
export function currentUserAgent(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return ua.slice(0, 400);
}

/** "Chrome on macOS", "Safari on iPhone", ... from a user agent string. */
export function describeUserAgent(ua: string): string {
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Browser';
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /CrOS/.test(ua)
              ? 'ChromeOS'
              : /Linux/.test(ua)
                ? 'Linux'
                : '';
  return os ? `${browser} on ${os}` : browser;
}

/** Label for this browser. */
export function currentDeviceLabel(): string {
  return describeUserAgent(currentUserAgent()).slice(0, 80);
}
