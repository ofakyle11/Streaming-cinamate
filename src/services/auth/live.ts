import type { EmailOtpType, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { NotConfiguredError, type AuthService, type User } from '../types';
import { SYNC_TABLES } from '../db/live';
import { authRedirectUrl, requireEmail, requirePassword } from './validate';

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
}

/** Shown for expired, reused or malformed sign-in links. Never echoes provider text. */
export const LINK_INVALID_MESSAGE = 'This sign-in link has expired or was already used. Request a new one.';

const OTP_TYPES = new Set(['magiclink', 'signup', 'invite', 'recovery', 'email_change', 'email']);

/** Maps a callback error code to fixed copy; the provider's description is never shown. */
export function callbackErrorMessage(code?: string): string {
  if (code === 'access_denied') return 'Sign-in was cancelled.';
  return LINK_INVALID_MESSAGE;
}

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
      str(meta.display_name) ?? str(meta.full_name) ?? str(meta.name) ?? (email.split('@')[0] || 'Viewer'),
    avatarUrl: str(meta.avatar_url) ?? str(meta.picture),
    createdAt: u.created_at,
  };
}

function asError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
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
export function createLiveAuth(supabaseUrl: string, anonKey: string, opts: LiveAuthOptions = {}): AuthService {
  const loadClient =
    opts.loadClient ??
    (async () => {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(supabaseUrl, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    });

  let clientPromise: Promise<SupabaseLike> | null = null;
  const client = (): Promise<SupabaseLike> => {
    if (!supabaseUrl || !anonKey) {
      return Promise.reject(new NotConfiguredError('Auth', 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'));
    }
    if (!clientPromise) {
      clientPromise = loadClient().catch((err: unknown) => {
        clientPromise = null; // allow a retry (e.g. chunk failed to load offline)
        throw asError(err, 'Could not reach the sign-in service.');
      });
    }
    return clientPromise;
  };

  return {
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
        result = await sb.auth.verifyOtp({ token_hash: params.token_hash, type: params.type as EmailOtpType });
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

    async signOut() {
      const sb = await client();
      const { error } = await sb.auth.signOut();
      if (error) throw asError(error, 'Sign-out failed.');
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
          const { data } = sb.auth.onAuthStateChange((_event, session) => {
            cb(session?.user ? toUser(session.user) : null);
          });
          unsubscribe = () => data.subscription.unsubscribe();
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
}
