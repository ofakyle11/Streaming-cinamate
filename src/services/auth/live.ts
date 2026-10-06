import type { EmailOtpType, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { NotConfiguredError, type AuthService, type Device, type User } from '../types';
import { SYNC_TABLES } from '../db/live';
import { authRedirectUrl, requireEmail, requirePassword } from './validate';
import { callbackErrorMessage, LINK_INVALID_MESSAGE } from './messages';
import {
  currentDeviceId,
  currentDeviceLabel,
  currentUserAgent,
  DEVICES_TABLE,
  forgetDeviceId,
} from './devices';

export { callbackErrorMessage, LINK_INVALID_MESSAGE } from './messages';

/** Table that queues server-side erasure (see supabase/migrations). */
export const DELETION_REQUESTS_TABLE = 'account_deletion_requests';

/** The slice of the Supabase client this adapter uses; lets tests inject a fake. */
export type SupabaseLike = Pick<SupabaseClient, 'auth' | 'from'>;

export interface LiveAuthOptions {
  /**
   * Returns the Supabase client. Defaults to a lazy dynamic import of
   * @supabase/supabase-js so the SDK is code-split out of the main bundle.
   */
  loadClient?: () => Promise<SupabaseLike>;
  /** This browser's device id (tests). Defaults to the stored `lf.device` id. */
  deviceId?: () => string;
  /** How often a signed-in tab re-checks that its device was not forgotten. */
  deviceCheckIntervalMs?: number;
}

/** Re-check the device row this often while signed in (also on every tab focus). */
export const DEVICE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

interface DeviceRow {
  id: string;
  label: string;
  user_agent: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

function toDevice(row: DeviceRow, currentId: string): Device {
  return {
    id: row.id,
    label: row.label,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    current: row.id === currentId,
  };
}

const OTP_TYPES = new Set(['magiclink', 'signup', 'invite', 'recovery', 'email_change', 'email']);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Map a Supabase user to our domain User. */
export function toUser(u: SupabaseUser): User {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const email = u.email ?? str(meta.email) ?? '';
  return {
    id: u.id,
    email,
    displayName:
      str(meta.display_name) ??
      str(meta.full_name) ??
      str(meta.name) ??
      (email.split('@')[0] || 'Viewer'),
    avatarUrl: str(meta.avatar_url) ?? str(meta.picture),
    createdAt: u.created_at,
  };
}

function asError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (
    err &&
    typeof err === 'object' &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    return new Error((err as { message: string }).message);
  }
  return new Error(fallback);
}

/**
 * Live auth adapter backed by Supabase Auth (magic link + Google OAuth, plus
 * email/password). Only the public URL + anon key are used; both come from
 * VITE_* env vars. If the client cannot be created the adapter degrades: the
 * user is reported as signed out and sign-in calls reject with a readable error.
 */
export function createLiveAuth(
  supabaseUrl: string,
  anonKey: string,
  opts: LiveAuthOptions = {},
): AuthService {
  const loadClient =
    opts.loadClient ??
    (async () => {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(supabaseUrl, anonKey, {
        // detectSessionInUrl is off: src/auth/callbackBoot.ts strips the tokens from
        // /auth/callback before the SDK loads, and AuthCallbackPage passes them to
        // completeSignIn() instead.
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
    });

  let clientPromise: Promise<SupabaseLike> | null = null;
  const client = (): Promise<SupabaseLike> => {
    if (!supabaseUrl || !anonKey) {
      return Promise.reject(
        new NotConfiguredError('Auth', 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'),
      );
    }
    if (!clientPromise) {
      clientPromise = loadClient().catch((err: unknown) => {
        clientPromise = null; // allow a retry (e.g. chunk failed to load offline)
        throw asError(err, 'Could not reach the sign-in service.');
      });
    }
    return clientPromise;
  };

  const deviceId = opts.deviceId ?? currentDeviceId;
  const checkEvery = opts.deviceCheckIntervalMs ?? DEVICE_CHECK_INTERVAL_MS;

  /**
   * Register (or touch) this browser in public.devices and report whether it
   * was forgotten from another device. One upsert does both: the trigger keeps
   * `revoked_at` once set and bumps `last_seen_at`. Best effort: a failure
   * never affects the session.
   */
  const touchDevice = async (
    sb: SupabaseLike,
    id: string,
  ): Promise<'ok' | 'revoked' | 'unknown'> => {
    try {
      const { data, error } = await sb
        .from(DEVICES_TABLE)
        .upsert(
          { id, label: currentDeviceLabel(), user_agent: currentUserAgent() },
          { onConflict: 'user_id,id' },
        )
        .select('revoked_at')
        .single();
      if (error || !data) return 'unknown';
      return (data as { revoked_at: string | null }).revoked_at ? 'revoked' : 'ok';
    } catch {
      return 'unknown';
    }
  };

  /** Forgotten elsewhere: drop our row and sign this browser out. */
  const leaveRevokedDevice = async (sb: SupabaseLike) => {
    try {
      await sb.from(DEVICES_TABLE).delete().eq('id', deviceId());
    } catch {
      /* the row is revoked either way */
    }
    try {
      await sb.auth.signOut({ scope: 'local' });
    } catch {
      /* already signed out */
    }
    forgetDeviceId();
  };

  // While a session exists: touch on start, on every tab focus and every few
  // minutes, so a device forgotten from the account page signs out within
  // minutes. Only one watcher runs, whatever the number of subscribers.
  let watcher: { stop: () => void } | null = null;
  const watchDevice = (sb: SupabaseLike, fresh = false) => {
    if (watcher || typeof window === 'undefined') return;
    // One check at a time; a request that lands mid-check runs once it is done.
    let running = false;
    let again = false;
    const check = async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        if (fresh) {
          // A new sign-in on a browser that was forgotten while closed: its old
          // row is still revoked and would bounce it. Start from a clean row.
          fresh = false;
          try {
            await sb.from(DEVICES_TABLE).delete().eq('id', deviceId());
          } catch {
            /* the touch below re-creates it either way */
          }
        }
        do {
          again = false;
          const id = deviceId();
          const state = await touchDevice(sb, id);
          if (watcher === null) {
            // Another tab of this browser signed out while the upsert was in
            // flight and forgot the id: the row it re-created belongs to nobody.
            try {
              await sb.from(DEVICES_TABLE).delete().eq('id', id);
            } catch {
              /* best effort */
            }
            return;
          }
          if (state === 'revoked') {
            await leaveRevokedDevice(sb);
            return;
          }
        } while (again);
      } finally {
        running = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void check(), checkEvery);
    watcher = {
      stop: () => {
        document.removeEventListener('visibilitychange', onVisible);
        window.clearInterval(timer);
      },
    };
    // Off the auth callback's stack: the SDK may hold its session lock there.
    window.setTimeout(() => void check(), 0);
  };
  const unwatchDevice = () => {
    watcher?.stop();
    watcher = null;
  };

  const service: AuthService = {
    async currentUser() {
      try {
        const sb = await client();
        const { data, error } = await sb.auth.getSession();
        if (error) return null;
        return data.session?.user ? toUser(data.session.user) : null;
      } catch {
        return null; // never crash the app because auth is unavailable
      }
    },

    async signInWithEmail(email, password) {
      const normalized = requireEmail(email);
      requirePassword(password);
      const sb = await client();
      const { data, error } = await sb.auth.signInWithPassword({ email: normalized, password });
      if (error || !data.user) throw asError(error, 'Sign-in failed.');
      return toUser(data.user);
    },

    async signUpWithEmail(email, password, displayName) {
      const normalized = requireEmail(email);
      requirePassword(password);
      const sb = await client();
      const { data, error } = await sb.auth.signUp({
        email: normalized,
        password,
        options: {
          emailRedirectTo: authRedirectUrl(),
          data: displayName?.trim() ? { display_name: displayName.trim() } : undefined,
        },
      });
      if (error || !data.user) throw asError(error, 'Sign-up failed.');
      return toUser(data.user);
    },

    async signInWithMagicLink(email, options) {
      const normalized = requireEmail(email);
      const sb = await client();
      const { error } = await sb.auth.signInWithOtp({
        email: normalized,
        options: {
          emailRedirectTo: authRedirectUrl(),
          shouldCreateUser: true,
          ...(options?.captchaToken ? { captchaToken: options.captchaToken } : {}),
        },
      });
      if (error) throw asError(error, 'Could not send the magic link.');
    },

    async completeSignIn(params) {
      if (params.error || params.error_code) {
        throw new Error(callbackErrorMessage(params.error_code ?? params.error));
      }
      const sb = await client();
      let result: { data: { user: SupabaseUser | null }; error: unknown };
      if (params.code) {
        result = await sb.auth.exchangeCodeForSession(params.code);
      } else if (params.access_token && params.refresh_token) {
        result = await sb.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
      } else if (params.token_hash && params.type && OTP_TYPES.has(params.type)) {
        result = await sb.auth.verifyOtp({
          token_hash: params.token_hash,
          type: params.type as EmailOtpType,
        });
      } else {
        // Nothing usable in the URL: maybe the session already exists (link opened twice).
        const { data } = await sb.auth.getSession();
        if (data.session?.user) return toUser(data.session.user);
        throw new Error(LINK_INVALID_MESSAGE);
      }
      if (result.error || !result.data.user) {
        // A second exchange of the same link (double render, two tabs) fails,
        // but the first one may already have signed the user in.
        const { data } = await sb.auth.getSession();
        if (data.session?.user) return toUser(data.session.user);
        throw new Error(LINK_INVALID_MESSAGE);
      }
      return toUser(result.data.user);
    },

    async signInWithOAuth(provider) {
      const sb = await client();
      const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: { redirectTo: authRedirectUrl() },
      });
      if (error) throw asError(error, 'Could not start sign-in.');
    },

    async signOut(options) {
      const sb = await client();
      const scope = options?.scope === 'global' ? 'global' : 'local';
      // Best effort on the device rows; the sign-out itself must not depend on them.
      // Rows are touched before the sign-out on purpose: once the token is
      // revoked nothing here can write them any more. If the sign-out call then
      // fails, the other browsers still leave (the user asked for that) and
      // this one stays signed in with the error shown.
      try {
        if (scope === 'global') {
          // The revocation only invalidates refresh tokens: another browser keeps
          // its access token for up to jwt_expiry. Revoking its row makes it take
          // the self sign-out path on its next check instead of lingering.
          const { data } = await sb.auth.getSession();
          const userId = data.session?.user.id;
          if (userId) {
            await sb
              .from(DEVICES_TABLE)
              .update({ revoked_at: new Date().toISOString() })
              .eq('user_id', userId)
              .neq('id', deviceId());
          }
        }
        await sb.from(DEVICES_TABLE).delete().eq('id', deviceId());
      } catch {
        /* best effort */
      }
      const { error } = await sb.auth.signOut({ scope });
      if (error) throw asError(error, 'Sign-out failed.');
      forgetDeviceId();
    },

    async listDevices() {
      const sb = await client();
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session?.user) return [];
      const { data, error } = await sb
        .from(DEVICES_TABLE)
        .select('id, label, user_agent, created_at, last_seen_at, revoked_at')
        .is('revoked_at', null)
        .order('last_seen_at', { ascending: false });
      if (error) throw asError(error, 'Could not load your devices.');
      const me = deviceId();
      return ((data ?? []) as DeviceRow[]).map((row) => toDevice(row, me));
    },

    async forgetDevice(id) {
      if (id === deviceId()) return service.signOut();
      const sb = await client();
      const { error } = await sb
        .from(DEVICES_TABLE)
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw asError(error, 'Could not forget that device.');
    },

    async changeEmail(newEmail) {
      const normalized = requireEmail(newEmail);
      const sb = await client();
      const { error } = await sb.auth.updateUser(
        { email: normalized },
        { emailRedirectTo: authRedirectUrl() },
      );
      if (error) throw asError(error, 'Could not change your email address.');
    },

    async requestDataDeletion() {
      const sb = await client();
      const { data, error: sessionError } = await sb.auth.getSession();
      const userId = data.session?.user.id;
      if (sessionError || !userId) throw new Error('Sign in to delete your account data.');
      // Erase the synced rows right away (RLS delete-own policies), so the next
      // sign-in cannot pull them back into the device. If any delete fails we
      // stop here: no request, no sign-out, local data stays intact.
      const results = await Promise.all(
        SYNC_TABLES.map((table) => sb.from(table).delete().eq('user_id', userId)),
      );
      const failed = results.find((r) => r.error);
      if (failed) throw asError(failed.error, 'Could not delete your cloud data.');
      // Erasing the auth user needs the service role, which never ships to the
      // client. Queue a request (RLS: users can only insert their own row);
      // lf_process_account_deletions() (service role / pg_cron) removes it.
      const { error } = await sb.from(DELETION_REQUESTS_TABLE).insert({ user_id: userId });
      if (error) throw asError(error, 'Could not request data deletion.');
      const { error: signOutError } = await sb.auth.signOut();
      if (signOutError) throw asError(signOutError, 'Sign-out failed.');
    },

    onAuthStateChange(cb) {
      let unsubscribe: (() => void) | null = null;
      let cancelled = false;
      client()
        .then((sb) => {
          if (cancelled) return;
          const { data } = sb.auth.onAuthStateChange((event, session) => {
            if (session?.user) watchDevice(sb, event === 'SIGNED_IN');
            else unwatchDevice();
            cb(session?.user ? toUser(session.user) : null);
          });
          unsubscribe = () => {
            data.subscription.unsubscribe();
            unwatchDevice();
          };
        })
        .catch(() => {
          /* auth unavailable: stay in guest mode */
        });
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    },
  };
  return service;
}
