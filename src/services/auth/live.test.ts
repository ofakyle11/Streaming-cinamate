import { describe, expect, it, vi } from 'vitest';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { SYNC_TABLES } from '../db/live';
import { createLiveAuth, DELETION_REQUESTS_TABLE, toUser, type SupabaseLike } from './live';
import { DEVICES_TABLE } from './devices';

const sbUser = (over: Partial<SupabaseUser> = {}): SupabaseUser =>
  ({
    id: 'uuid-1',
    email: 'ada@example.com',
    created_at: '2026-01-02T00:00:00Z',
    app_metadata: {},
    aud: 'authenticated',
    user_metadata: { full_name: 'Ada Lovelace', avatar_url: 'https://example.com/a.png' },
    ...over,
  }) as SupabaseUser;

function fakeClient(session: { user: SupabaseUser } | null = null) {
  let listener: ((event: string, s: { user: SupabaseUser } | null) => void) | null = null;
  const unsubscribe = vi.fn();
  // Call log shared by delete + insert so tests can assert ordering.
  const calls: string[] = [];
  const insert = vi.fn<(row: unknown) => Promise<{ error: null }>>(async () => {
    calls.push('insert');
    return { error: null };
  });
  const deleteErrors: Record<string, unknown> = {};
  const eq = vi.fn();
  const del = vi.fn();
  const upsert = vi.fn();
  const update = vi.fn();
  const select = vi.fn();
  // Row returned to the device registration upsert (`.select('revoked_at').single()`).
  const deviceState = { revoked_at: null as string | null };
  const deviceRows: unknown[] = [];
  const auth = {
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: sbUser() }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: sbUser() }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn((cb: typeof listener) => {
      listener = cb;
      return { data: { subscription: { unsubscribe } } };
    }),
  };
  const from = vi.fn((table: string) => ({
    insert,
    delete: (...args: unknown[]) => {
      del(table, ...args);
      return {
        eq: async (col: string, val: unknown) => {
          eq(table, col, val);
          calls.push(`delete:${table}`);
          return { error: deleteErrors[table] ?? null };
        },
      };
    },
    upsert: (row: unknown, opts: unknown) => {
      upsert(table, row, opts);
      return {
        select: () => ({ single: async () => ({ data: { ...deviceState }, error: null }) }),
      };
    },
    update: (patch: unknown) => ({
      eq: async (col: string, val: unknown) => {
        update(table, patch, col, val);
        return { error: null };
      },
    }),
    select: (cols: string) => ({
      is: (col: string, val: unknown) => ({
        order: async (by: string, o: unknown) => {
          select(table, cols, col, val, by, o);
          return { data: deviceRows, error: null };
        },
      }),
    }),
  }));
  const client = { auth, from } as unknown as SupabaseLike;
  return {
    client,
    auth,
    from,
    insert,
    del,
    eq,
    upsert,
    update,
    select,
    deviceState,
    deviceRows,
    calls,
    deleteErrors,
    unsubscribe,
    emit: (s: { user: SupabaseUser } | null) => listener?.('X', s),
  };
}

const make = (fake: ReturnType<typeof fakeClient>, deviceId = 'this-device-1') =>
  createLiveAuth('https://proj.supabase.co', 'anon-key', {
    loadClient: async () => fake.client,
    deviceId: () => deviceId,
    deviceCheckIntervalMs: 60_000,
  });

describe('live auth adapter (Supabase)', () => {
  it('maps Supabase users to domain users', () => {
    expect(toUser(sbUser())).toEqual({
      id: 'uuid-1',
      email: 'ada@example.com',
      displayName: 'Ada Lovelace',
      avatarUrl: 'https://example.com/a.png',
      createdAt: '2026-01-02T00:00:00Z',
    });
    expect(toUser(sbUser({ user_metadata: {} })).displayName).toBe('ada');
  });

  it('reads the current session', async () => {
    expect(await make(fakeClient()).currentUser()).toBeNull();
    expect(await make(fakeClient({ user: sbUser() })).currentUser()).toMatchObject({
      id: 'uuid-1',
    });
  });

  it('sends a magic link with a redirect back to /account', async () => {
    const fake = fakeClient();
    await make(fake).signInWithMagicLink(' Ada@Example.com ');
    expect(fake.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
  });

  it('validates the email before calling Supabase', async () => {
    const fake = fakeClient();
    await expect(make(fake).signInWithMagicLink('bad')).rejects.toThrow(/valid email/);
    expect(fake.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('starts Google OAuth', async () => {
    const fake = fakeClient();
    await make(fake).signInWithOAuth('google');
    expect(fake.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });

  it('surfaces Supabase errors as Error messages', async () => {
    const fake = fakeClient();
    fake.auth.signInWithOtp.mockResolvedValueOnce({ data: {}, error: { message: 'Rate limited' } });
    await expect(make(fake).signInWithMagicLink('a@b.co')).rejects.toThrow('Rate limited');
  });

  it('forwards auth state changes and unsubscribes', async () => {
    const fake = fakeClient();
    const cb = vi.fn();
    const off = make(fake).onAuthStateChange(cb);
    await vi.waitFor(() => expect(fake.auth.onAuthStateChange).toHaveBeenCalled());
    fake.emit({ user: sbUser() });
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'uuid-1' }));
    fake.emit(null);
    expect(cb).toHaveBeenLastCalledWith(null);
    off();
    expect(fake.unsubscribe).toHaveBeenCalled();
  });

  it('queues a deletion request for the signed-in user and signs out', async () => {
    const fake = fakeClient({ user: sbUser() });
    await make(fake).requestDataDeletion();
    expect(fake.from).toHaveBeenCalledWith(DELETION_REQUESTS_TABLE);
    expect(fake.insert).toHaveBeenCalledWith({ user_id: 'uuid-1' });
    expect(fake.auth.signOut).toHaveBeenCalled();
  });

  it('hard-deletes every cloud sync table for the user before queuing the request', async () => {
    const fake = fakeClient({ user: sbUser() });
    await make(fake).requestDataDeletion();
    expect(SYNC_TABLES).toEqual(['profiles', 'watchlist', 'history', 'ratings']);
    for (const table of SYNC_TABLES) {
      expect(fake.from).toHaveBeenCalledWith(table);
      expect(fake.del).toHaveBeenCalledWith(table);
      expect(fake.eq).toHaveBeenCalledWith(table, 'user_id', 'uuid-1');
    }
    expect(fake.eq).toHaveBeenCalledTimes(SYNC_TABLES.length);
    expect(fake.calls.at(-1)).toBe('insert');
    expect(fake.calls.slice(0, -1).sort()).toEqual(SYNC_TABLES.map((t) => `delete:${t}`).sort());
    expect(fake.auth.signOut.mock.invocationCallOrder[0]).toBeGreaterThan(
      fake.insert.mock.invocationCallOrder[0],
    );
  });

  it('rejects without queuing or signing out when a cloud delete fails', async () => {
    const fake = fakeClient({ user: sbUser() });
    fake.deleteErrors.history = { message: 'permission denied for table history' };
    await expect(make(fake).requestDataDeletion()).rejects.toThrow(
      'permission denied for table history',
    );
    expect(fake.insert).not.toHaveBeenCalled();
    expect(fake.auth.signOut).not.toHaveBeenCalled();

    const fallback = fakeClient({ user: sbUser() });
    fallback.deleteErrors.ratings = {};
    await expect(make(fallback).requestDataDeletion()).rejects.toThrow(
      'Could not delete your cloud data.',
    );
    expect(fallback.insert).not.toHaveBeenCalled();
    expect(fallback.auth.signOut).not.toHaveBeenCalled();
  });

  it('refuses deletion when signed out', async () => {
    const fake = fakeClient(null);
    await expect(make(fake).requestDataDeletion()).rejects.toThrow(/Sign in/);
    expect(fake.del).not.toHaveBeenCalled();
    expect(fake.insert).not.toHaveBeenCalled();
  });

  it('never crashes when keys are missing or the SDK fails to load', async () => {
    const noKeys = createLiveAuth('', '');
    expect(await noKeys.currentUser()).toBeNull();
    await expect(noKeys.signInWithMagicLink('a@b.co')).rejects.toThrow(/not configured/);
    expect(() => noKeys.onAuthStateChange(() => {})()).not.toThrow();

    const loadClient = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(fakeClient().client);
    const flaky = createLiveAuth('https://x.supabase.co', 'k', { loadClient });
    expect(await flaky.currentUser()).toBeNull();
    // Retries after a failed load.
    await expect(flaky.signInWithOAuth('google')).resolves.toBeUndefined();
    expect(loadClient).toHaveBeenCalledTimes(2);
  });

  it('signs out this browser by default and everywhere on request', async () => {
    const fake = fakeClient({ user: sbUser() });
    await make(fake).signOut();
    expect(fake.auth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
    expect(fake.eq).toHaveBeenLastCalledWith(DEVICES_TABLE, 'id', 'this-device-1');

    await make(fake).signOut({ scope: 'global' });
    expect(fake.auth.signOut).toHaveBeenLastCalledWith({ scope: 'global' });
    // Every device row goes with the global revocation.
    expect(fake.eq).toHaveBeenLastCalledWith(DEVICES_TABLE, 'user_id', 'uuid-1');
  });

  it('lists active devices newest first and marks this browser', async () => {
    const fake = fakeClient({ user: sbUser() });
    fake.deviceRows.push(
      {
        id: 'other-device-2',
        label: 'Safari on iPhone',
        user_agent: 'ua2',
        created_at: 'c2',
        last_seen_at: 's2',
        revoked_at: null,
      },
      {
        id: 'this-device-1',
        label: 'Chrome on macOS',
        user_agent: 'ua1',
        created_at: 'c1',
        last_seen_at: 's1',
        revoked_at: null,
      },
    );
    const devices = await make(fake).listDevices();
    expect(devices.map((d) => [d.id, d.current, d.label])).toEqual([
      ['other-device-2', false, 'Safari on iPhone'],
      ['this-device-1', true, 'Chrome on macOS'],
    ]);
    expect(fake.select).toHaveBeenCalledWith(
      DEVICES_TABLE,
      'id, label, user_agent, created_at, last_seen_at, revoked_at',
      'revoked_at',
      null,
      'last_seen_at',
      { ascending: false },
    );
    expect(await make(fakeClient(null)).listDevices()).toEqual([]);
  });

  it('forgets another device by revoking it, and this one by signing out', async () => {
    const fake = fakeClient({ user: sbUser() });
    const auth = make(fake);
    await auth.forgetDevice('other-device-2');
    expect(fake.update).toHaveBeenCalledWith(
      DEVICES_TABLE,
      { revoked_at: expect.stringMatching(/^\d{4}-/) },
      'id',
      'other-device-2',
    );
    expect(fake.auth.signOut).not.toHaveBeenCalled();
    await auth.forgetDevice('this-device-1');
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('registers this browser when a session appears and signs out once it is revoked', async () => {
    const fake = fakeClient();
    make(fake).onAuthStateChange(() => {});
    await vi.waitFor(() => expect(fake.auth.onAuthStateChange).toHaveBeenCalled());
    fake.emit({ user: sbUser() });
    await vi.waitFor(() => expect(fake.upsert).toHaveBeenCalled());
    expect(fake.upsert).toHaveBeenCalledWith(
      DEVICES_TABLE,
      { id: 'this-device-1', label: expect.any(String), user_agent: expect.any(String) },
      { onConflict: 'user_id,id' },
    );
    expect(fake.auth.signOut).not.toHaveBeenCalled();

    // Forgotten from another device: the next check (tab focus) signs us out.
    fake.deviceState.revoked_at = '2026-10-06T00:00:00Z';
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    expect(fake.eq).toHaveBeenCalledWith(DEVICES_TABLE, 'id', 'this-device-1');
  });

  it('starts an email change confirmed through the callback route', async () => {
    const fake = fakeClient({ user: sbUser() });
    await make(fake).changeEmail(' New@Example.com ');
    expect(fake.auth.updateUser).toHaveBeenCalledWith(
      { email: 'new@example.com' },
      { emailRedirectTo: `${window.location.origin}/auth/callback` },
    );
    await expect(make(fake).changeEmail('nope')).rejects.toThrow(/valid email/);
  });
});
