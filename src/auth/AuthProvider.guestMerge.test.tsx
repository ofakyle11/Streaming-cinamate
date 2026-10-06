import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '.';
import { createMockAuth } from '../services/auth/mock';
import { readSyncOwner, startCloudSync } from '../services';
import type { SyncChange, SyncSnapshot } from '../services/types';
import { useLastFrameStore } from '../state/store';

function Probe() {
  return <p>{useAuth().status}</p>;
}

/** In-memory cloud seeded with one account; records every upload. */
function fakeCloud(seed: SyncSnapshot) {
  const pushes: SyncChange[] = [];
  const db = {
    pullSnapshot: vi.fn(async () => structuredClone(seed)),
    pushChanges: vi.fn(async (_userId: string, changes: SyncChange[]) => {
      pushes.push(...changes);
    }),
  };
  return { db, pushes };
}

function mount(cloud: ReturnType<typeof fakeCloud>, service = createMockAuth()) {
  const startSync = (userId: string) =>
    startCloudSync(userId, {
      db: cloud.db,
      store: useLastFrameStore,
      debounceMs: 5,
      flushOnHide: false,
    });
  render(
    <AuthProvider service={service} mode="mock" clearLocal={vi.fn()} startSync={startSync}>
      <Probe />
    </AuthProvider>,
  );
  return service;
}

const localTitles = () =>
  Object.values(useLastFrameStore.getState().watchlist)
    .flat()
    .map((e) => e.titleId)
    .sort((a, b) => a - b);

describe('first sign-in keeps the guest list', () => {
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
      useLastFrameStore.getState().addToWatchlist(101, 'movie');
      useLastFrameStore.getState().addToWatchlist(102, 'tv');
    });
  });

  it('merges the guest watchlist into an account that already has one and uploads it', async () => {
    const cloud = fakeCloud({
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
      watchlist: [{ profileId: 'pa', titleId: 7, addedAt: 20, updatedAt: 20, deleted: false }],
      history: [],
      ratings: [],
    });
    const service = mount(cloud);
    expect(await screen.findByText('guest')).toBeInTheDocument();

    await act(() => service.signInWithMagicLink('ada@example.com'));
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    await waitFor(() => expect(readSyncOwner()).toBe('mock-ada'));
    await waitFor(() => expect(cloud.db.pushChanges).toHaveBeenCalled());

    // Both the guest's titles and the account's cloud title are on the device...
    expect(localTitles()).toEqual([7, 101, 102]);
    // ...and the guest's titles went up to the account; nothing was replaced or deleted.
    const uploaded = cloud.pushes
      .filter(
        (c): c is Extract<SyncChange, { table: 'watchlist' }> =>
          c.table === 'watchlist' && !c.row.deleted,
      )
      .map((c) => c.row.titleId)
      .sort((a, b) => a - b);
    expect(uploaded).toEqual([101, 102]);
    expect(cloud.pushes.some((c) => c.row.deleted)).toBe(false);
  });

  it('uploads the whole guest list into a brand-new account', async () => {
    const cloud = fakeCloud({ profiles: [], watchlist: [], history: [], ratings: [] });
    const service = mount(cloud);
    expect(await screen.findByText('guest')).toBeInTheDocument();
    await act(() => service.signInWithMagicLink('new@example.com'));
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    await waitFor(() => expect(cloud.db.pushChanges).toHaveBeenCalled());

    const uploaded = cloud.pushes
      .filter((c): c is Extract<SyncChange, { table: 'watchlist' }> => c.table === 'watchlist')
      .map((c) => c.row.titleId)
      .sort((a, b) => a - b);
    expect(uploaded).toEqual([101, 102]);
    expect(cloud.pushes.filter((c) => c.table === 'profiles').map((c) => c.row.profileId)).toEqual([
      'guest',
    ]);
    expect(localTitles()).toEqual([101, 102]);
  });
});
