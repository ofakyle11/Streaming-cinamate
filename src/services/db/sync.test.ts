import { describe, expect, it } from 'vitest';
import type { SyncChange, SyncSnapshot } from '../types';
import {
  adoptSnapshot,
  diffStates,
  freshGuestState,
  mergeSnapshots,
  rowKey,
  rowsFromState,
  stateFromRows,
  type SyncableState,
} from './sync';

const profile = (id: string, name = 'Ada', createdAt = 100) => ({ id, name, avatar: 'aurora', kid: false, createdAt });

const baseState = (over: Partial<SyncableState> = {}): SyncableState => ({
  activeProfileId: 'p1',
  profiles: [profile('p1')],
  watchlist: {},
  history: {},
  ratings: {},
  ...over,
});

const emptyRemote = (): SyncSnapshot => ({ profiles: [], watchlist: [], history: [], ratings: [] });

const remoteProfile = (id: string, over: Partial<SyncSnapshot['profiles'][number]> = {}) => ({
  profileId: id,
  name: 'Remote',
  avatar: 'dusk',
  kid: false,
  createdAt: 50,
  updatedAt: 50,
  deleted: false,
  ...over,
});

describe('rowsFromState / stateFromRows', () => {
  it('round-trips the store data', () => {
    const state = baseState({
      profiles: [profile('p1', 'Ada', 100), profile('p2', 'Kid', 200)],
      watchlist: { p1: [{ titleId: 2, addedAt: 20 }, { titleId: 1, addedAt: 10 }] },
      history: { p2: [{ titleId: 5, position: 30, duration: 60, lastWatchedAt: 99, completed: false }] },
      ratings: { p1: [{ titleId: 7, rating: 4, ratedAt: 70 }] },
    });
    const rows = rowsFromState(state);
    expect(rows.size).toBe(6); // 2 profiles + 2 watchlist + 1 history + 1 rating
    expect(rows.get('watchlist:p1:2')?.row.updatedAt).toBe(20);
    expect(stateFromRows(rows.values(), 'p1')).toEqual(state);
  });

  it('skips tombstones, drops orphans and repairs the active profile', () => {
    const rows: SyncChange[] = [
      { table: 'profiles', row: remoteProfile('a') },
      { table: 'profiles', row: remoteProfile('b', { deleted: true }) },
      { table: 'watchlist', row: { profileId: 'b', titleId: 1, addedAt: 1, updatedAt: 1, deleted: false } },
    ];
    const state = stateFromRows(rows, 'b');
    expect(state.profiles.map((p) => p.id)).toEqual(['a']);
    expect(state.activeProfileId).toBe('a');
    expect(state.watchlist).toEqual({});
  });
});

describe('diffStates', () => {
  it('returns nothing when the data slices are unchanged', () => {
    const s = baseState();
    expect(diffStates(s, { ...s, activeProfileId: 'other' }, 5)).toEqual([]);
  });

  it('stamps upserts and tombstones with the change time', () => {
    const prev = baseState({ watchlist: { p1: [{ titleId: 1, addedAt: 10 }] } });
    const next = baseState({
      profiles: [{ ...profile('p1'), name: 'Renamed' }],
      watchlist: { p1: [{ titleId: 2, addedAt: 20 }] },
    });
    const changes = diffStates(prev, next, 999);
    const byKey = new Map(changes.map((c) => [rowKey(c), c]));
    expect(byKey.get('profiles:p1')).toMatchObject({ row: { name: 'Renamed', updatedAt: 999, deleted: false } });
    expect(byKey.get('watchlist:p1:2')).toMatchObject({ row: { updatedAt: 999, deleted: false } });
    expect(byKey.get('watchlist:p1:1')).toMatchObject({ row: { titleId: 1, updatedAt: 999, deleted: true } });
    expect(changes).toHaveLength(3);
  });
});

describe('mergeSnapshots (last write wins)', () => {
  it('uploads local-only rows and pulls remote-only rows', () => {
    const local = baseState({ watchlist: { p1: [{ titleId: 1, addedAt: 10 }] } });
    const remote = emptyRemote();
    remote.profiles.push(remoteProfile('p1', { name: 'Ada', createdAt: 100, updatedAt: 100, avatar: 'aurora' }));
    remote.ratings.push({ profileId: 'p1', titleId: 9, rating: 5, ratedAt: 40, updatedAt: 40, deleted: false });

    const { state, push } = mergeSnapshots(local, remote);
    expect(state.watchlist.p1).toEqual([{ titleId: 1, addedAt: 10 }]);
    expect(state.ratings.p1).toEqual([{ titleId: 9, rating: 5, ratedAt: 40 }]);
    expect(push.map(rowKey)).toEqual(['watchlist:p1:1']);
  });

  it('keeps the newer side of a conflict', () => {
    const local = baseState({
      history: { p1: [{ titleId: 5, position: 10, duration: 100, lastWatchedAt: 500, completed: false }] },
      ratings: { p1: [{ titleId: 7, rating: 2, ratedAt: 100 }] },
    });
    const remote = emptyRemote();
    remote.profiles.push(remoteProfile('p1', { name: 'Ada', createdAt: 100, updatedAt: 100, avatar: 'aurora' }));
    remote.history.push({ profileId: 'p1', titleId: 5, position: 90, duration: 100, lastWatchedAt: 400, completed: false, updatedAt: 400, deleted: false });
    remote.ratings.push({ profileId: 'p1', titleId: 7, rating: 5, ratedAt: 300, updatedAt: 300, deleted: false });

    const { state, push } = mergeSnapshots(local, remote);
    expect(state.history.p1[0].position).toBe(10); // local newer
    expect(state.ratings.p1[0].rating).toBe(5); // remote newer
    expect(push.map(rowKey)).toEqual(['history:p1:5']);
  });

  it('applies remote tombstones newer than the local row', () => {
    const local = baseState({ watchlist: { p1: [{ titleId: 1, addedAt: 10 }, { titleId: 2, addedAt: 900 }] } });
    const remote = emptyRemote();
    remote.profiles.push(remoteProfile('p1', { name: 'Ada', createdAt: 100, updatedAt: 100 }));
    remote.watchlist.push(
      { profileId: 'p1', titleId: 1, addedAt: 10, updatedAt: 50, deleted: true },
      { profileId: 'p1', titleId: 2, addedAt: 1, updatedAt: 50, deleted: true },
    );
    const { state, push } = mergeSnapshots(local, remote);
    expect(state.watchlist.p1).toEqual([{ titleId: 2, addedAt: 900 }]); // re-added after the delete
    expect(push.map(rowKey)).toEqual(['watchlist:p1:2']);
  });

  it('uses pending local edits (incl. deletes) over intrinsic timestamps', () => {
    const local = baseState({ profiles: [profile('p1', 'Renamed', 100)] });
    const remote = emptyRemote();
    remote.profiles.push(remoteProfile('p1', { name: 'Old', createdAt: 100, updatedAt: 500 }));
    remote.watchlist.push({ profileId: 'p1', titleId: 3, addedAt: 20, updatedAt: 20, deleted: false });

    const pendingChanges: SyncChange[] = [
      { table: 'profiles', row: { ...remoteProfile('p1'), name: 'Renamed', avatar: 'aurora', createdAt: 100, updatedAt: 600 } },
      { table: 'watchlist', row: { profileId: 'p1', titleId: 3, addedAt: 20, updatedAt: 600, deleted: true } },
    ];
    const pending = new Map(pendingChanges.map((c) => [rowKey(c), c]));
    const { state, push } = mergeSnapshots(local, remote, pending);
    expect(state.profiles[0].name).toBe('Renamed');
    expect(state.watchlist.p1).toBeUndefined();
    expect(push.map(rowKey).sort()).toEqual(['profiles:p1', 'watchlist:p1:3']);
  });

  it('without pending edits a remote profile rename wins', () => {
    const local = baseState({ profiles: [profile('p1', 'Ada', 100)] });
    const remote = emptyRemote();
    remote.profiles.push(remoteProfile('p1', { name: 'Ada L.', createdAt: 100, updatedAt: 800 }));
    const { state, push } = mergeSnapshots(local, remote);
    expect(state.profiles[0].name).toBe('Ada L.');
    expect(push).toEqual([]);
  });

  it("drops this device's untouched default profile when the account already has profiles", () => {
    const local = baseState({ activeProfileId: 'fresh', profiles: [profile('fresh', 'Me', 1_000)] });
    const remote = emptyRemote();
    remote.profiles.push(remoteProfile('acct'));
    const { state, push } = mergeSnapshots(local, remote);
    expect(state.profiles.map((p) => p.id)).toEqual(['acct']);
    expect(state.activeProfileId).toBe('acct');
    expect(push).toEqual([]);
  });

  it('keeps a default-named profile that has data', () => {
    const local = baseState({
      activeProfileId: 'fresh',
      profiles: [profile('fresh', 'Me', 1_000)],
      watchlist: { fresh: [{ titleId: 1, addedAt: 5 }] },
    });
    const remote = emptyRemote();
    remote.profiles.push(remoteProfile('acct'));
    const { state, push } = mergeSnapshots(local, remote);
    expect(state.profiles.map((p) => p.id)).toEqual(['acct', 'fresh']);
    expect(state.activeProfileId).toBe('fresh');
    expect(push.map(rowKey).sort()).toEqual(['profiles:fresh', 'watchlist:fresh:1']);
  });

  it('uploads everything on first sign-in to an empty account', () => {
    const local = baseState({ profiles: [profile('p1', 'Me')] });
    const { state, push } = mergeSnapshots(local, emptyRemote());
    expect(state.profiles.map((p) => p.id)).toEqual(['p1']);
    expect(push.map(rowKey)).toEqual(['profiles:p1']);
  });

  it('always leaves at least one profile', () => {
    const local = baseState();
    const remote = emptyRemote();
    remote.profiles.push(remoteProfile('p1', { deleted: true, updatedAt: 10_000 }));
    const { state, push } = mergeSnapshots(local, remote, new Map(), 20_000);
    expect(state.profiles.map((p) => p.id)).toEqual(['p1']);
    expect(push).toEqual([{ table: 'profiles', row: expect.objectContaining({ profileId: 'p1', deleted: false, updatedAt: 20_000 }) }]);
  });
});

describe('freshGuestState / adoptSnapshot', () => {
  const remoteProfile = (profileId: string) => ({
    profileId,
    name: 'Bea',
    avatar: 'meadow',
    kid: false,
    createdAt: 5,
    updatedAt: 5,
    deleted: false,
  });
  const snapshot = (over: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
    profiles: [],
    watchlist: [],
    history: [],
    ratings: [],
    ...over,
  });

  it('creates one untouched default profile with no lists', () => {
    const s = freshGuestState(42);
    expect(s.profiles).toEqual([expect.objectContaining({ name: 'Me', createdAt: 42, kid: false })]);
    expect(s.activeProfileId).toBe(s.profiles[0].id);
    expect([s.watchlist, s.history, s.ratings]).toEqual([{}, {}, {}]);
    expect(freshGuestState().profiles[0].id).not.toBe(s.profiles[0].id);
  });

  it("takes the account's snapshot as-is and pushes nothing when it has profiles", () => {
    const remote = snapshot({
      profiles: [remoteProfile('pb')],
      watchlist: [{ profileId: 'pb', titleId: 7, addedAt: 9, updatedAt: 9, deleted: false }],
    });
    const { state, push } = adoptSnapshot(remote, new Map(), 1_000);
    expect(push).toEqual([]);
    expect(state.profiles.map((p) => p.id)).toEqual(['pb']);
    expect(state.watchlist).toEqual({ pb: [{ titleId: 7, addedAt: 9 }] });
  });

  it('keeps the own pending queue and gives an empty account a default profile', () => {
    const own: SyncChange = { table: 'profiles', row: { ...remoteProfile('pnew'), name: 'Offline', updatedAt: 50 } };
    const withOwn = adoptSnapshot(snapshot({ profiles: [remoteProfile('pb')] }), new Map([[rowKey(own), own]]), 60);
    expect(withOwn.push).toEqual([own]);
    expect(withOwn.state.profiles.map((p) => p.id).sort()).toEqual(['pb', 'pnew']);

    const empty = adoptSnapshot(snapshot(), new Map(), 60);
    expect(empty.state.profiles).toHaveLength(1);
    expect(empty.push.map(rowKey)).toEqual([`profiles:${empty.state.profiles[0].id}`]);
  });
});
