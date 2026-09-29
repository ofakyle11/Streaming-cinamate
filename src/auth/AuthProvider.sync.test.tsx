import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '.';
import { createMockAuth } from '../services/auth/mock';
import type { CloudSync } from '../services';

function fakeSync() {
  const handle = {
    status: 'synced' as const,
    ready: Promise.resolve(),
    flush: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
  };
  return handle satisfies CloudSync;
}

function Probe() {
  const auth = useAuth();
  return (
    <>
      <p>{auth.status}</p>
      <button onClick={() => void auth.signOut()}>out</button>
      <button onClick={() => void auth.deleteData().catch(() => undefined)}>wipe</button>
    </>
  );
}

describe('AuthProvider cloud sync wiring', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not sync guests', async () => {
    const startSync = vi.fn(() => fakeSync());
    render(
      <AuthProvider service={createMockAuth()} mode="mock" clearLocal={vi.fn()} startSync={startSync}>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('guest')).toBeInTheDocument();
    expect(startSync).not.toHaveBeenCalled();
  });

  it('starts sync on sign-in, flushes before sign-out and stops afterwards', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    const handle = fakeSync();
    const startSync = vi.fn(() => handle);
    const signOut = vi.spyOn(service, 'signOut');
    render(
      <AuthProvider service={service} mode="mock" clearLocal={vi.fn()} startSync={startSync}>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    const user = await service.currentUser();
    expect(startSync).toHaveBeenCalledWith(user?.id);

    fireEvent.click(screen.getByRole('button', { name: 'out' }));
    expect(await screen.findByText('guest')).toBeInTheDocument();
    expect(handle.flush).toHaveBeenCalled();
    expect(handle.flush.mock.invocationCallOrder[0]).toBeLessThan(signOut.mock.invocationCallOrder[0]);
    await waitFor(() => expect(handle.stop).toHaveBeenCalled());
  });

  it('discards the sync queue before wiping local data', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    const handle = fakeSync();
    const clearLocal = vi.fn();
    render(
      <AuthProvider service={service} mode="mock" clearLocal={clearLocal} startSync={() => handle}>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'wipe' }));
    await waitFor(() => expect(clearLocal).toHaveBeenCalled());
    expect(handle.stop).toHaveBeenCalledWith({ discard: true });
    expect(handle.stop.mock.invocationCallOrder[0]).toBeLessThan(clearLocal.mock.invocationCallOrder[0]);
  });

  it('resumes sync when the deletion request fails', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    vi.spyOn(service, 'requestDataDeletion').mockRejectedValue(new Error('offline'));
    const startSync = vi.fn(() => fakeSync());
    const clearLocal = vi.fn();
    render(
      <AuthProvider service={service} mode="mock" clearLocal={clearLocal} startSync={startSync}>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(startSync).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'wipe' }));
    await waitFor(() => expect(startSync).toHaveBeenCalledTimes(2));
    expect(clearLocal).not.toHaveBeenCalled();
  });
});
