import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext, AuthProvider, clearLocalData, isLastFrameKey } from '../auth';
import type { AuthContextValue } from '../auth';
import { createMockAuth, makeMockUser } from '../services/auth/mock';
import { createMockDb } from '../services/db/mock';
import type { AuthService, DbService } from '../services/types';
import { useLastFrameStore } from '../state/store';
import { ToastProvider } from '../components/ui';
import type { Device } from '../components/account/contract';
import AccountPage from './AccountPage';
import { findLive, getLive, queryLive } from '../test/liveRegions';

/** AuthService plus the account methods the Supabase backend thread adds. */
type ExtendedAuth = AuthService & {
  listDevices?: () => Promise<Device[]>;
  forgetDevice?: (id: string) => Promise<void>;
  changeEmail?: (email: string) => Promise<void>;
};

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="location">{loc.pathname + loc.search}</span>;
}

/**
 * Renders the page over a hand-built auth context so a test can control the
 * account methods on useAuth() (listDevices, forgetDevice, changeEmail).
 */
function renderWithContext(
  extra: Partial<Pick<ExtendedAuth, 'listDevices' | 'forgetDevice' | 'changeEmail'>>,
  path = '/account',
) {
  const user = makeMockUser('ada@example.com');
  const base = createMockAuth();
  const value = {
    status: 'authenticated' as const,
    user,
    isGuest: false,
    mode: 'mock' as const,
    signInWithMagicLink: vi.fn(async () => undefined),
    signInWithOAuth: vi.fn(async () => undefined),
    completeSignIn: base.completeSignIn,
    signOut: vi.fn(async () => undefined),
    deleteData: vi.fn(async () => undefined),
    // The real provider always forwards these; a test overrides the ones it exercises.
    listDevices: async (): Promise<Device[]> => [],
    forgetDevice: vi.fn(async () => undefined),
    changeEmail: vi.fn(async () => undefined),
    ...extra,
  } satisfies AuthContextValue;
  render(
    <ToastProvider>
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/account" element={<AccountPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </ToastProvider>,
  );
  return value;
}

function renderPage(
  service: AuthService = createMockAuth(),
  clearLocal = vi.fn(),
  { path = '/account', db }: { path?: string; db?: DbService } = {},
) {
  render(
    <ToastProvider>
      <AuthProvider service={service} mode="mock" clearLocal={clearLocal}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/account" element={<AccountPage db={db} />} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </AuthProvider>
    </ToastProvider>,
  );
  return { service, clearLocal };
}

async function signedIn(extra: Partial<ExtendedAuth> = {}): Promise<ExtendedAuth> {
  const service: ExtendedAuth = { ...createMockAuth(), ...extra };
  await service.signInWithMagicLink('ada@example.com');
  return service;
}

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('AccountPage: guest', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to guest mode and points at the sign-in page', async () => {
    renderPage();
    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/sign-in?returnTo=%2Faccount',
    );
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.queryByRole('button', { name: /google/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull();
  });

  it('opens the security tab by default and switches tabs through the URL', async () => {
    renderPage();
    await screen.findByText('Guest mode');
    expect(tab(/sign-in & security/i)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/sign-in & security/i);

    fireEvent.click(tab(/your data/i));
    expect(tab(/your data/i)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('location')).toHaveTextContent('/account?tab=data');
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();

    fireEvent.click(tab(/sign-in & security/i));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/account$/);
  });

  it('leaves modifier clicks on a tab to the browser', async () => {
    renderPage();
    await screen.findByText('Guest mode');
    fireEvent.click(tab(/your data/i), { metaKey: true });
    expect(tab(/sign-in & security/i)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/your data/i)).toHaveAttribute('href', '/account?tab=data');
  });

  it('opens the tab named in the URL and ignores unknown ones', async () => {
    renderPage(createMockAuth(), vi.fn(), { path: '/account?tab=history' });
    expect(await screen.findByRole('heading', { name: 'Viewing history' })).toBeInTheDocument();
    expect(tab(/viewing history/i)).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to the security tab for an unknown tab', async () => {
    renderPage(createMockAuth(), vi.fn(), { path: '/account?tab=nope' });
    await screen.findByText('Guest mode');
    expect(tab(/sign-in & security/i)).toHaveAttribute('aria-selected', 'true');
  });

  it('moves between tabs with the arrow keys', async () => {
    renderPage();
    await screen.findByText('Guest mode');
    const first = tab(/sign-in & security/i);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(tab(/profiles/i)).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(tab(/profiles/i));
    fireEvent.keyDown(tab(/profiles/i), { key: 'End' });
    expect(tab(/your data/i)).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tab(/your data/i), { key: 'ArrowRight' });
    expect(tab(/sign-in & security/i)).toHaveAttribute('aria-selected', 'true');
  });

  it('lists profiles and switches the active one', async () => {
    useLastFrameStore.getState().addProfile({ name: 'Kid', kid: true });
    renderPage(createMockAuth(), vi.fn(), { path: '/account?tab=profiles' });
    const list = await screen.findByRole('list', { name: 'Profiles' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(within(list).getByRole('button', { name: 'Switch to Kid' }));
    expect(useLastFrameStore.getState().profiles.find((p) => p.name === 'Kid')?.id).toBe(
      useLastFrameStore.getState().activeProfileId,
    );
    expect(screen.getByRole('link', { name: /edit profiles/i })).toHaveAttribute(
      'href',
      '/profiles',
    );
  });

  it('falls back to guest mode when the adapter throws', async () => {
    const broken = {
      ...createMockAuth(),
      currentUser: () => Promise.reject(new Error('boom')),
      onAuthStateChange: () => {
        throw new Error('boom');
      },
    } as AuthService;
    renderPage(broken);
    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
  });
});

describe('AccountPage: signed in', () => {
  beforeEach(() => localStorage.clear());

  it('shows the account and signs out of this device', async () => {
    const service = await signedIn();
    const spy = vi.spyOn(service, 'signOut');
    renderPage(service);
    expect(
      await screen.findByText('ada@example.com', { selector: '.acct-email' }),
    ).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
    // The provider forwards the account methods of every adapter (mock included).
    expect(screen.getByRole('button', { name: /change email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out everywhere/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sign out of this device/i }));
    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
    // Explicit local scope: this browser only, whatever an adapter's default is.
    expect(spy).toHaveBeenCalledWith({ scope: 'local' });
    expect(getLive('status')).toHaveTextContent(/signed out of this device\. guest mode/i);
  });

  it('signs out everywhere after a confirm step with the global scope', async () => {
    const { signOut } = renderWithContext({ listDevices: async () => [] });
    expect(
      await screen.findByRole('button', { name: /sign out of this device/i }),
    ).toBeInTheDocument();
    await screen.findByText('ada@example.com', { selector: '.acct-email' });

    fireEvent.click(screen.getByRole('button', { name: /sign out everywhere/i }));
    const group = screen.getByRole('group', { name: /confirm signing out everywhere/i });
    expect(document.activeElement).toBe(within(group).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(group).getByRole('button', { name: /sign out everywhere/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: 'global' }));
    expect(await findLive('status')).toHaveTextContent(/signed out everywhere/i);
  });

  it('lists devices from the adapter and signs one out', async () => {
    const devices: Device[] = [
      {
        id: 'd1',
        label: 'Mac · Chrome',
        userAgent: 'Mac',
        createdAt: '2026-10-01T00:00:00Z',
        lastSeenAt: new Date().toISOString(),
        revokedAt: null,
        current: true,
      },
      {
        id: 'd2',
        label: 'iPhone · Safari',
        userAgent: 'iPhone',
        createdAt: '2026-10-01T00:00:00Z',
        lastSeenAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
        revokedAt: null,
        current: false,
      },
      {
        id: 'd3',
        label: 'Old laptop',
        userAgent: 'Win',
        createdAt: '2026-09-01T00:00:00Z',
        lastSeenAt: '2026-09-01T00:00:00Z',
        revokedAt: '2026-09-02T00:00:00Z',
        current: false,
      },
    ];
    const forgetDevice = vi.fn(async () => undefined);
    renderWithContext({ listDevices: async () => devices, forgetDevice });

    const list = await screen.findByRole('list', { name: 'Signed-in devices' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2); // revoked rows are hidden
    expect(within(list).getByText('Mac · Chrome')).toBeInTheDocument();
    expect(within(list).getByText('3 hours ago')).toBeInTheDocument();
    expect(within(list).getByText('This device')).toBeInTheDocument();

    fireEvent.click(within(list).getByRole('button', { name: 'Sign out iPhone · Safari' }));
    await waitFor(() => expect(forgetDevice).toHaveBeenCalledWith('d2'));
    await waitFor(() => expect(within(list).queryByText('iPhone · Safari')).toBeNull());
    expect(getLive('status')).toHaveTextContent(/iPhone · Safari will be signed out/i);
  });

  it('keeps sign-out available when the device list fails', async () => {
    renderWithContext({ listDevices: async () => Promise.reject(new Error('down')) });
    expect(await screen.findByText(/device list is not available/i)).toBeInTheDocument();
    expect(screen.getByText(/sign out of this device, or everywhere/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out everywhere/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('retries a failed device load', async () => {
    let calls = 0;
    const listDevices = async () => {
      calls += 1;
      if (calls === 1) throw new Error('down');
      return [
        {
          id: 'd1',
          label: 'Mac · Chrome',
          userAgent: 'Mac',
          createdAt: '',
          lastSeenAt: new Date().toISOString(),
          revokedAt: null,
          current: true,
        },
      ];
    };
    renderWithContext({ listDevices });
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('list', { name: 'Signed-in devices' })).toBeInTheDocument();
    expect(screen.queryByText(/device list is not available/i)).toBeNull();
  });

  it('keeps a device listed when signing it out fails', async () => {
    const devices: Device[] = [
      {
        id: 'd2',
        label: 'iPhone · Safari',
        userAgent: 'iPhone',
        createdAt: '',
        lastSeenAt: new Date().toISOString(),
        revokedAt: null,
        current: false,
      },
    ];
    renderWithContext({
      listDevices: async () => devices,
      forgetDevice: async () => Promise.reject(new Error('Nope')),
    });
    const list = await screen.findByRole('list', { name: 'Signed-in devices' });
    fireEvent.click(within(list).getByRole('button', { name: 'Sign out iPhone · Safari' }));
    expect(await findLive('alert')).toHaveTextContent('Nope');
    expect(within(list).getByText('iPhone · Safari')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Sign out iPhone · Safari' })).toBeEnabled();
  });

  it('changes the sign-in email when the adapter offers it', async () => {
    const changeEmail = vi.fn(async () => undefined);
    renderWithContext({ changeEmail });
    await screen.findByText('ada@example.com', { selector: '.acct-email' });

    fireEvent.click(screen.getByRole('button', { name: /change email/i }));
    const input = screen.getByLabelText('New email address');
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /send confirmation/i }));
    expect(getLive('alert')).toHaveTextContent(/valid email/i);
    expect(changeEmail).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: ' Ada.New@Example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: /send confirmation/i }));
    await waitFor(() => expect(changeEmail).toHaveBeenCalledWith('ada.new@example.com'));
    expect(await findLive('status')).toHaveTextContent(/ada@example.com and ada.new@example.com/);
    expect(screen.queryByLabelText('New email address')).toBeNull();

    // Reopening starts clean.
    fireEvent.click(screen.getByRole('button', { name: /change email/i }));
    expect(screen.getByLabelText('New email address')).toHaveValue('');
    expect(queryLive('alert')).toBeNull();
  });

  it('deletes the account after confirmation', async () => {
    const service = await signedIn();
    const spy = vi.spyOn(service, 'requestDataDeletion');
    const { clearLocal } = renderPage(service, vi.fn(), { path: '/account?tab=data' });

    fireEvent.click(await screen.findByRole('button', { name: /delete my account/i }));
    expect(clearLocal).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Delete account' })).toBeInTheDocument();
    expect(screen.getByText(/within 24 hours/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /yes, delete my account/i }));

    await waitFor(() => expect(clearLocal).toHaveBeenCalledTimes(1));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
    expect(getLive('status')).toHaveTextContent(/within 24 hours/);
  });

  it('keeps local data when server deletion fails', async () => {
    const service = await signedIn();
    vi.spyOn(service, 'requestDataDeletion').mockRejectedValue(new Error('Network down'));
    const { clearLocal } = renderPage(service, vi.fn(), { path: '/account?tab=data' });

    fireEvent.click(await screen.findByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete my account/i }));
    expect(await findLive('alert')).toHaveTextContent('Network down');
    expect(clearLocal).not.toHaveBeenCalled();
  });
});

describe('AccountPage: download my data', () => {
  beforeEach(() => {
    localStorage.clear();
    clearLocalData();
  });
  afterEach(() => vi.unstubAllGlobals());

  function stubDownload() {
    const create = vi.fn(() => 'blob:lastframe');
    const revoke = vi.fn();
    vi.stubGlobal(
      'URL',
      Object.assign(Object.create(URL), { createObjectURL: create, revokeObjectURL: revoke }),
    );
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this);
    });
    return { create, clicks };
  }

  it('downloads this device’s data as a guest', async () => {
    const { create, clicks } = stubDownload();
    useLastFrameStore.getState().addToWatchlist(42, 'movie');
    renderPage(createMockAuth(), vi.fn(), { path: '/account?tab=data' });

    fireEvent.click(await screen.findByRole('button', { name: /download/i }));
    await waitFor(() => expect(clicks).toHaveLength(1));
    expect(clicks[0].download).toMatch(/^lastframe-export-\d{4}-\d{2}-\d{2}\.json$/);
    expect(create).toHaveBeenCalledTimes(1);
    expect(await findLive('status')).toHaveTextContent(/2 saved items/); // default profile + 1 list entry
  });

  it('exports this device’s copy when there is no cloud copy, even when signed in', async () => {
    const { clicks } = stubDownload();
    const service = await signedIn();
    const db: DbService = {
      ...createMockDb(),
      pullSnapshot: async () => ({
        profiles: [
          {
            profileId: 'p1',
            name: 'Ada',
            avatar: 'aurora',
            kid: false,
            createdAt: 1,
            updatedAt: 1,
            deleted: false,
          },
        ],
        watchlist: [
          { profileId: 'p1', titleId: 1, addedAt: 1, updatedAt: 1, deleted: false },
          { profileId: 'p1', titleId: 2, addedAt: 1, updatedAt: 2, deleted: true },
        ],
        history: [],
        ratings: [],
      }),
    };
    renderPage(service, vi.fn(), { path: '/account?tab=data', db });

    fireEvent.click(await screen.findByRole('button', { name: /download/i }));
    await waitFor(() => expect(clicks).toHaveLength(1));
    // Mock mode holds no cloud copy, so the device store (one default profile) is exported, not the snapshot.
    expect(await findLive('status')).toHaveTextContent(/1 saved item\b/);
  });

  it('reports a blocked download', async () => {
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: undefined }));
    renderPage(createMockAuth(), vi.fn(), { path: '/account?tab=data' });
    fireEvent.click(await screen.findByRole('button', { name: /download/i }));
    expect(await findLive('alert')).toHaveTextContent(/blocked the download/i);
  });
});

describe('Delete my data clears the PWA image cache', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  async function confirmDelete() {
    fireEvent.click(await screen.findByRole('button', { name: /delete my (data|account)/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
  }

  it('deletes the lf-images cache in guest/mock mode', async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: del });
    const { clearLocal } = renderPage(createMockAuth(), vi.fn(), { path: '/account?tab=data' });

    await confirmDelete();

    await waitFor(() => expect(del).toHaveBeenCalledWith('lf-images'));
    expect(del).toHaveBeenCalledTimes(1);
    expect(clearLocal).toHaveBeenCalledTimes(1);
    expect(clearLocal.mock.invocationCallOrder[0]).toBeLessThan(del.mock.invocationCallOrder[0]);
    expect(await findLive('status')).toHaveTextContent(/deleted/i);
  });

  it('still clears local data when Cache Storage is unavailable', async () => {
    vi.stubGlobal('caches', undefined);
    localStorage.setItem('lf.mock.db', '{}');
    useLastFrameStore.getState().addToWatchlist(7);
    renderPage(
      createMockAuth(),
      vi.fn(() => void clearLocalData()),
      { path: '/account?tab=data' },
    );

    await confirmDelete();

    await waitFor(() => expect(localStorage.getItem('lf.mock.db')).toBeNull());
    expect(useLastFrameStore.getState().watchlist).toEqual({});
    expect(await findLive('status')).toHaveTextContent(/deleted/i);
    expect(queryLive('alert')).not.toBeInTheDocument();
  });

  it('still resolves and signs out when deleting the cache rejects', async () => {
    const del = vi.fn(() => Promise.reject(new Error('SecurityError')));
    vi.stubGlobal('caches', { delete: del });
    const service = await signedIn();
    const { clearLocal } = renderPage(service, vi.fn(), { path: '/account?tab=data' });

    await confirmDelete();

    await waitFor(() => expect(del).toHaveBeenCalledWith('lf-images'));
    expect(clearLocal).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
    expect(queryLive('alert')).not.toBeInTheDocument();
  });

  it('does not touch the cache when server deletion fails', async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: del });
    const service = await signedIn();
    vi.spyOn(service, 'requestDataDeletion').mockRejectedValue(new Error('Network down'));
    renderPage(service, vi.fn(), { path: '/account?tab=data' });

    await confirmDelete();

    expect(await findLive('alert')).toHaveTextContent('Network down');
    expect(del).not.toHaveBeenCalled();
  });
});

describe('clearLocalData', () => {
  beforeEach(() => {
    localStorage.clear();
    clearLocalData();
  });

  it('removes Lastframe.tv keys only and resets the store', () => {
    localStorage.setItem('lastframe', '{}');
    localStorage.setItem('lf.mock.db', '{}');
    localStorage.setItem('lf.mock.auth.session', '{}');
    localStorage.setItem('other-app', 'keep');
    useLastFrameStore.getState().addToWatchlist(42);
    expect(Object.values(useLastFrameStore.getState().watchlist).flat()).toHaveLength(1);

    clearLocalData();

    expect(localStorage.getItem('lf.mock.db')).toBeNull();
    expect(localStorage.getItem('lf.mock.auth.session')).toBeNull();
    expect(localStorage.getItem('other-app')).toBe('keep');
    const s = useLastFrameStore.getState();
    expect(s.watchlist).toEqual({});
    expect(s.profiles).toHaveLength(1);
    expect(s.activeProfileId).toBe(s.profiles[0].id);
  });

  it('recognises owned keys', () => {
    expect(isLastFrameKey('lastframe')).toBe(true);
    expect(isLastFrameKey('lf.anything')).toBe(true);
    expect(isLastFrameKey('lastframes')).toBe(false);
    expect(isLastFrameKey('sb-abc-auth-token')).toBe(false);
  });
});
