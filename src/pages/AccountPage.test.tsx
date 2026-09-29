import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, clearLocalData, isLastFrameKey } from '../auth';
import { createMockAuth } from '../services/auth/mock';
import type { AuthService } from '../services/types';
import { useLastFrameStore } from '../state/store';
import { ToastProvider } from '../components/ui';
import AccountPage from './AccountPage';

function renderPage(service: AuthService = createMockAuth(), clearLocal = vi.fn()) {
  render(
    <ToastProvider>
      <AuthProvider service={service} mode="mock" clearLocal={clearLocal}>
        <AccountPage />
      </AuthProvider>
    </ToastProvider>,
  );
  return { service, clearLocal };
}

describe('AccountPage + AuthProvider', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to guest mode', async () => {
    renderPage();
    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /magic link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('signs in with a magic link, shows the email, then signs out', async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /magic link/i }));
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/signed out/i);
  });

  it('shows a validation error for a bad email', async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /magic link/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });

  it('signs in with Google', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /continue with google/i }));
    expect(await screen.findByText('Demo Viewer')).toBeInTheDocument();
  });

  it('deletes data after confirmation', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    const spy = vi.spyOn(service, 'requestDataDeletion');
    const { clearLocal } = renderPage(service);

    fireEvent.click(await screen.findByRole('button', { name: /delete my data/i }));
    expect(clearLocal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }));

    await waitFor(() => expect(clearLocal).toHaveBeenCalledTimes(1));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
  });

  it('keeps local data when server deletion fails', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    vi.spyOn(service, 'requestDataDeletion').mockRejectedValue(new Error('Network down'));
    const { clearLocal } = renderPage(service);

    fireEvent.click(await screen.findByRole('button', { name: /delete my data/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    expect(clearLocal).not.toHaveBeenCalled();
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

describe('Delete my data clears the PWA image cache', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  async function confirmDelete() {
    fireEvent.click(await screen.findByRole('button', { name: /delete my data/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }));
  }

  it('deletes the lf-images cache in guest/mock mode', async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: del });
    const { clearLocal } = renderPage();

    await confirmDelete();

    await waitFor(() => expect(del).toHaveBeenCalledWith('lf-images'));
    expect(del).toHaveBeenCalledTimes(1);
    expect(clearLocal).toHaveBeenCalledTimes(1);
    expect(clearLocal.mock.invocationCallOrder[0]).toBeLessThan(del.mock.invocationCallOrder[0]);
    expect(await screen.findByRole('status')).toHaveTextContent(/deleted/i);
  });

  it('still clears local data when Cache Storage is unavailable', async () => {
    vi.stubGlobal('caches', undefined);
    localStorage.setItem('lf.mock.db', '{}');
    useLastFrameStore.getState().addToWatchlist(7);
    renderPage(createMockAuth(), vi.fn(() => void clearLocalData()));

    await confirmDelete();

    await waitFor(() => expect(localStorage.getItem('lf.mock.db')).toBeNull());
    expect(useLastFrameStore.getState().watchlist).toEqual({});
    expect(await screen.findByRole('status')).toHaveTextContent(/deleted/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still resolves and signs out when deleting the cache rejects', async () => {
    const del = vi.fn(() => Promise.reject(new Error('SecurityError')));
    vi.stubGlobal('caches', { delete: del });
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    const { clearLocal } = renderPage(service);

    await confirmDelete();

    await waitFor(() => expect(del).toHaveBeenCalledWith('lf-images'));
    expect(clearLocal).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not touch the cache when server deletion fails', async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: del });
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    vi.spyOn(service, 'requestDataDeletion').mockRejectedValue(new Error('Network down'));
    renderPage(service);

    await confirmDelete();

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    expect(del).not.toHaveBeenCalled();
  });
});

describe('clearLocalData', () => {
  it('removes Last Frame keys only and resets the store', () => {
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
