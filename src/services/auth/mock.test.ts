import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAuth, MOCK_SESSION_KEY, MOCK_SESSION_TTL_MS } from './mock';

describe('mock auth adapter', () => {
  beforeEach(() => localStorage.clear());

  it('starts signed out (guest)', async () => {
    expect(await createMockAuth().currentUser()).toBeNull();
  });

  it('magic link signs in immediately and persists a fake session in localStorage', async () => {
    const auth = createMockAuth();
    await auth.signInWithMagicLink('  Ada@Example.com ');
    const user = await auth.currentUser();
    expect(user).toMatchObject({ email: 'ada@example.com', displayName: 'ada' });

    const stored = JSON.parse(localStorage.getItem(MOCK_SESSION_KEY) ?? 'null');
    expect(stored.user.email).toBe('ada@example.com');
    expect(stored.accessToken).toMatch(/^mock\./);
    expect(stored.expiresAt).toBeGreaterThan(Date.now());

    // A fresh adapter (page reload) restores the session.
    expect(await createMockAuth().currentUser()).toMatchObject({ email: 'ada@example.com' });
  });

  it('rejects invalid emails', async () => {
    const auth = createMockAuth();
    await expect(auth.signInWithMagicLink('nope')).rejects.toThrow(/valid email/);
    expect(await auth.currentUser()).toBeNull();
  });

  it('Google OAuth signs in a demo user', async () => {
    const auth = createMockAuth();
    await auth.signInWithOAuth('google');
    expect(await auth.currentUser()).toMatchObject({ displayName: 'Demo Viewer' });
  });

  it('expires sessions after the TTL', async () => {
    let t = 1_000_000;
    const auth = createMockAuth({ now: () => t });
    await auth.signInWithMagicLink('a@b.co');
    expect(await auth.currentUser()).not.toBeNull();
    t += MOCK_SESSION_TTL_MS + 1;
    expect(await auth.currentUser()).toBeNull();
    expect(localStorage.getItem(MOCK_SESSION_KEY)).toBeNull();
  });

  it('notifies listeners and supports unsubscribe', async () => {
    const auth = createMockAuth();
    const cb = vi.fn();
    const off = auth.onAuthStateChange(cb);
    await auth.signInWithMagicLink('a@b.co');
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ email: 'a@b.co' }));
    await auth.signOut();
    expect(cb).toHaveBeenLastCalledWith(null);
    off();
    await auth.signInWithMagicLink('a@b.co');
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('requestDataDeletion wipes the mock DB and signs out', async () => {
    const auth = createMockAuth();
    await auth.signInWithMagicLink('a@b.co');
    localStorage.setItem('lf.mock.db', '{"entries":[]}');
    await auth.requestDataDeletion();
    expect(localStorage.getItem('lf.mock.db')).toBeNull();
    expect(await auth.currentUser()).toBeNull();
  });

  it('migrates the legacy bare-user key', async () => {
    localStorage.setItem(
      'lf.mock.auth.user',
      JSON.stringify({
        id: 'mock-x',
        email: 'x@y.z',
        displayName: 'x',
        createdAt: new Date().toISOString(),
      }),
    );
    expect(await createMockAuth().currentUser()).toMatchObject({ id: 'mock-x' });
    expect(localStorage.getItem('lf.mock.auth.user')).toBeNull();
    expect(localStorage.getItem(MOCK_SESSION_KEY)).not.toBeNull();
  });

  it('ignores corrupt storage and works without storage at all', async () => {
    localStorage.setItem(MOCK_SESSION_KEY, '{not json');
    expect(await createMockAuth().currentUser()).toBeNull();

    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const auth = createMockAuth({ storage: throwing });
    await auth.signInWithMagicLink('a@b.co');
    expect(await auth.currentUser()).toMatchObject({ email: 'a@b.co' });

    const noStorage = createMockAuth({ storage: null });
    await noStorage.signInWithOAuth('google');
    expect(await noStorage.currentUser()).not.toBeNull();
  });

  it('has one device, this browser, and forgetting it signs out', async () => {
    const auth = createMockAuth();
    expect(await auth.listDevices()).toEqual([]);
    await auth.signInWithMagicLink('ada@example.com');
    const [device, ...rest] = await auth.listDevices();
    expect(rest).toEqual([]);
    expect(device).toMatchObject({ current: true, revokedAt: null });
    expect(device.id).toBe(localStorage.getItem('lf.device'));
    await auth.forgetDevice('someone-elses-device');
    expect(await auth.currentUser()).not.toBeNull();
    await auth.forgetDevice(device.id);
    expect(await auth.currentUser()).toBeNull();
    expect(localStorage.getItem('lf.device')).toBeNull();
  });

  it('changes the email immediately when signed in', async () => {
    const auth = createMockAuth();
    await expect(auth.changeEmail('new@example.com')).rejects.toThrow(/Sign in/);
    await auth.signInWithMagicLink('ada@example.com');
    await auth.changeEmail(' New@Example.com ');
    expect(await auth.currentUser()).toMatchObject({ email: 'new@example.com' });
  });
});
