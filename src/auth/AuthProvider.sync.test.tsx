import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '.';
import { createMockAuth } from '../services/auth/mock';
import { readSyncOwner, startCloudSync, type CloudSync } from '../services';
import type { SyncChange, SyncSnapshot } from '../services/types';
import { useLastFrameStore } from '../state/store';

function fakeSync(linked = true) {
  const handle = {
    status: 'synced' as const,
    linked,
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
      <AuthProvider
        service={createMockAuth()}
        mode="mock"
        clearLocal={vi.fn()}
        startSync={startSync}
      >
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
    expect(handle.flush.mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[0],
    );
    await waitFor(() => expect(handle.stop).toHaveBeenCalled());
  });

  it('resets the synced data when the session ends from outside (forgotten device, expiry)', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    const handle = fakeSync(true);
    render(
      <AuthProvider service={service} mode="mock" clearLocal={vi.fn()} startSync={() => handle}>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    useLastFrameStore.setState({ watchlist: { p: [{ titleId: 603, addedAt: 1 }] } } as never);

    // Another device forgot this one: the adapter signs out without going through signOut().
    await act(async () => {
      await service.forgetDevice((await service.listDevices())[0].id);
    });
    expect(await screen.findByText('guest')).toBeInTheDocument();
    await waitFor(() => expect(handle.stop).toHaveBeenCalledWith({ flush: false }));
    expect(handle.flush).not.toHaveBeenCalled();
    expect(useLastFrameStore.getState().watchlist).toEqual({});
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
    expect(handle.stop.mock.invocationCallOrder[0]).toBeLessThan(
      clearLocal.mock.invocationCallOrder[0],
    );
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

  it('resets the synced data after sign-out only when it came from the cloud', async () => {
    for (const linked of [true, false]) {
      localStorage.clear();
      const service = createMockAuth();
      await service.signInWithMagicLink('ada@example.com');
      const handle = fakeSync(linked);
      const resetSynced = vi.fn();
      const signOut = vi.spyOn(service, 'signOut');
      const view = render(
        <AuthProvider
          service={service}
          mode="mock"
          clearLocal={vi.fn()}
          startSync={() => handle}
          resetSynced={resetSynced}
        >
          <Probe />
        </AuthProvider>,
      );
      expect(await screen.findByText('authenticated')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'out' }));
      expect(await screen.findByText('guest')).toBeInTheDocument();
      // Sync is stopped before the reset, so the reset is never uploaded as deletions.
      expect(handle.stop).toHaveBeenCalledWith({ flush: false });
      if (linked) {
        expect(resetSynced).toHaveBeenCalledTimes(1);
        expect(handle.stop.mock.invocationCallOrder[0]).toBeLessThan(
          resetSynced.mock.invocationCallOrder[0],
        );
        expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(
          resetSynced.mock.invocationCallOrder[0],
        );
      } else {
        // Mock DB / sync never linked: the device copy is the only copy, keep it.
        expect(resetSynced).not.toHaveBeenCalled();
      }
      view.unmount();
    }
  });

  it('keeps data and resumes sync when sign-out fails', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    vi.spyOn(service, 'signOut').mockRejectedValue(new Error('offline'));
    const startSync = vi.fn(() => fakeSync());
    const resetSynced = vi.fn();
    function FailingProbe() {
      const auth = useAuth();
      return (
        <>
          <p>{auth.status}</p>
          <button onClick={() => void auth.signOut().catch(() => undefined)}>out</button>
        </>
      );
    }
    render(
      <AuthProvider
        service={service}
        mode="mock"
        clearLocal={vi.fn()}
        startSync={startSync}
        resetSynced={resetSynced}
      >
        <FailingProbe />
      </AuthProvider>,
    );
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'out' }));
    await waitFor(() => expect(startSync).toHaveBeenCalledTimes(2));
    expect(resetSynced).not.toHaveBeenCalled();
    expect(screen.getByText('authenticated')).toBeInTheDocument();
  });
});

/* ---------------------------------------------- end-to-end: account switch */

const emptySnapshot = (): SyncSnapshot => ({
  profiles: [],
  watchlist: [],
  history: [],
  ratings: [],
});

/** In-memory cloud: one snapshot per user, records every upload. */
function fakeCloud(seed: Record<string, SyncSnapshot>) {
  const pushes: Record<string, SyncChange[]> = {};
  const db = {
    pullSnapshot: vi.fn(async (userId: string) => structuredClone(seed[userId] ?? emptySnapshot())),
    pushChanges: vi.fn(async (userId: string, changes: SyncChange[]) => {
      (pushes[userId] ??= []).push(...changes);
    }),
  };
  return { db, pushes };
}

const accountA = (): SyncSnapshot => ({
  profiles: [
    {
      profileId: 'pa',
      name: 'Ada',
      avatar: 'aurora',
      kid: false,
      createdAt: 10,
      updatedAt: 10,
      deleted: false,
    },
  ],
  watchlist: [{ profileId: 'pa', titleId: 11, addedAt: 20, updatedAt: 20, deleted: false }],
  history: [
    {
      profileId: 'pa',
      titleId: 12,
      position: 60,
      duration: 600,
      lastWatchedAt: 30,
      completed: false,
      updatedAt: 30,
      deleted: false,
    },
  ],
  ratings: [
    { profileId: 'pa', titleId: 13, rating: 5, ratedAt: 40, updatedAt: 40, deleted: false },
  ],
});

const accountB = (): SyncSnapshot => ({
  ...emptySnapshot(),
  profiles: [
    {
      profileId: 'pb',
      name: 'Bea',
      avatar: 'meadow',
      kid: false,
      createdAt: 15,
      updatedAt: 15,
      deleted: false,
    },
  ],
});

const A_TITLES = new Set([11, 12, 13]);

describe('AuthProvider cloud sync: sign in A, sign out, sign in B', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useLastFrameStore.setState({
        profiles: [{ id: 'guest', name: 'Me', avatar: '🎬', kid: false, createdAt: 1 }],
        activeProfileId: 'guest',
        watchlist: {},
        history: {},
        ratings: {},
      });
    });
  });

  const run = async (resetSynced?: () => void) => {
    const cloud = fakeCloud({ 'mock-ada': accountA(), 'mock-bea': accountB() });
    const service = createMockAuth();
    const startSync = (userId: string) =>
      startCloudSync(userId, {
        db: cloud.db,
        store: useLastFrameStore,
        debounceMs: 5,
        flushOnHide: false,
      });
    const extra = resetSynced ? { resetSynced } : {};
    render(
      <AuthProvider
        service={service}
        mode="mock"
        clearLocal={vi.fn()}
        startSync={startSync}
        {...extra}
      >
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('guest')).toBeInTheDocument();

    await act(() => service.signInWithMagicLink('ada@example.com'));
    await waitFor(() => expect(useLastFrameStore.getState().history.pa?.[0]?.titleId).toBe(12));
    await waitFor(() => expect(readSyncOwner()).toBe('mock-ada'));

    fireEvent.click(screen.getByRole('button', { name: 'out' }));
    expect(await screen.findByText('guest')).toBeInTheDocument();
    return { cloud, service };
  };

  const signInB = async (
    service: ReturnType<typeof createMockAuth>,
    cloud: ReturnType<typeof fakeCloud>,
  ) => {
    await act(() => service.signInWithMagicLink('bea@example.com'));
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    await waitFor(() => expect(readSyncOwner()).toBe('mock-bea'));
    await waitFor(() => expect(cloud.db.pullSnapshot).toHaveBeenCalledWith('mock-bea'));
    await new Promise((r) => setTimeout(r, 30)); // let any debounced upload run
  };

  const expectNoLeak = (cloud: ReturnType<typeof fakeCloud>) => {
    const toB = cloud.pushes['mock-bea'] ?? [];
    expect(toB.filter((c) => c.row.profileId === 'pa')).toEqual([]);
    expect(toB.filter((c) => c.table !== 'profiles' && A_TITLES.has(c.row.titleId))).toEqual([]);
    const state = useLastFrameStore.getState();
    expect(state.profiles.map((p) => p.id)).toEqual(['pb']);
    expect(state.watchlist.pa).toBeUndefined();
    expect(state.history.pa).toBeUndefined();
    expect(state.ratings.pa).toBeUndefined();
  };

  it("clears A's data on sign-out and never uploads it into B's account", async () => {
    const { cloud, service } = await run();
    // Signed out: A's data is gone from the device and it is guest data again.
    const guest = useLastFrameStore.getState();
    expect(guest.profiles).toHaveLength(1);
    expect(guest.profiles[0].name).toBe('Me');
    expect(guest.history).toEqual({});
    expect(guest.ratings).toEqual({});
    expect(readSyncOwner()).toBeNull();

    await signInB(service, cloud);
    expectNoLeak(cloud);
  });

  it("still never uploads A's data when it was left on the device (owner guard)", async () => {
    // e.g. the session ended elsewhere and the sign-out reset did not run.
    const { cloud, service } = await run(() => undefined);
    expect(useLastFrameStore.getState().history.pa?.[0]?.titleId).toBe(12);
    expect(readSyncOwner()).toBe('mock-ada');

    await signInB(service, cloud);
    expect(cloud.pushes['mock-bea'] ?? []).toEqual([]);
    expectNoLeak(cloud);
  });
});
