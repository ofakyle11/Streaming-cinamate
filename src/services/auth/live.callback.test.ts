import { describe, expect, it, vi } from 'vitest';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createLiveAuth, LINK_INVALID_MESSAGE, type SupabaseLike } from './live';

const user = {
  id: 'u1',
  email: 'ada@example.com',
  created_at: '2026-01-01T00:00:00Z',
  user_metadata: {},
} as unknown as SupabaseUser;

function fake(session: { user: SupabaseUser } | null = null) {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    setSession: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { user }, error: null }),
  };
  const adapter = createLiveAuth('https://p.supabase.co', 'anon', {
    loadClient: async () => ({ auth, from: vi.fn() }) as unknown as SupabaseLike,
  });
  return { auth, adapter };
}

describe('live auth: Turnstile token', () => {
  it('passes captchaToken to Supabase only when given', async () => {
    const { auth, adapter } = fake();
    await adapter.signInWithMagicLink('a@b.co', { captchaToken: 'tok' });
    expect(auth.signInWithOtp.mock.calls[0][0].options.captchaToken).toBe('tok');
    await adapter.signInWithMagicLink('a@b.co');
    expect(auth.signInWithOtp.mock.calls[1][0].options).not.toHaveProperty('captchaToken');
  });
});

describe('live auth: completeSignIn', () => {
  it('exchanges a PKCE code', async () => {
    const { auth, adapter } = fake();
    await expect(adapter.completeSignIn({ code: 'c1' })).resolves.toMatchObject({ id: 'u1' });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('c1');
  });

  it('sets an implicit-flow session', async () => {
    const { auth, adapter } = fake();
    await adapter.completeSignIn({ access_token: 'a', refresh_token: 'r' });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
  });

  it('verifies a token hash of a known type only', async () => {
    const { auth, adapter } = fake();
    await adapter.completeSignIn({ token_hash: 'h', type: 'magiclink' });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'h', type: 'magiclink' });
    await expect(adapter.completeSignIn({ token_hash: 'h', type: 'bogus' })).rejects.toThrow(
      LINK_INVALID_MESSAGE,
    );
  });

  it('maps provider errors to fixed copy without echoing the description', async () => {
    const { adapter } = fake();
    const err = adapter.completeSignIn({
      error: 'x',
      error_code: 'otp_expired',
      error_description: '<script>',
    });
    await expect(err).rejects.toThrow(LINK_INVALID_MESSAGE);
    await expect(adapter.completeSignIn({ error: 'access_denied' })).rejects.toThrow(
      'Sign-in was cancelled.',
    );
  });

  it('falls back to an existing session when the link was already used', async () => {
    const { auth, adapter } = fake({ user });
    auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('used'),
    });
    await expect(adapter.completeSignIn({ code: 'c1' })).resolves.toMatchObject({ id: 'u1' });
  });

  it('rejects a used link with no session', async () => {
    const { auth, adapter } = fake(null);
    auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('used'),
    });
    await expect(adapter.completeSignIn({ code: 'c1' })).rejects.toThrow(LINK_INVALID_MESSAGE);
    await expect(adapter.completeSignIn({})).rejects.toThrow(LINK_INVALID_MESSAGE);
  });
});
