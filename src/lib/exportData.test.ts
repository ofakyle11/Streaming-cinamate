import { describe, expect, it } from 'vitest';
import { buildDataExport, countExportItems, exportFileName } from './exportData';
import { useLastFrameStore } from '../state/store';
import type { SyncSnapshot, User } from '../services/types';

const user: User = {
  id: 'u1',
  email: 'ada@example.com',
  displayName: 'Ada',
  createdAt: '2026-10-01T00:00:00Z',
};

describe('buildDataExport', () => {
  it('reads this device when there is no cloud snapshot', () => {
    const s = useLastFrameStore.getState();
    s.addToWatchlist(42, 'movie');
    s.rateTitle(42, 5, { mediaType: 'movie', title: 'Neon Drift' }, 'movie');
    const data = buildDataExport(
      useLastFrameStore.getState(),
      null,
      null,
      new Date('2026-10-06T12:00:00Z'),
    );
    expect(data.format).toBe('lastframe.tv/export');
    expect(data.source).toBe('device');
    expect(data.account).toBeNull();
    expect(data.devices).toEqual([]);
    expect(data.exportedAt).toBe('2026-10-06T12:00:00.000Z');
    expect(data.watchlist).toEqual([
      expect.objectContaining({ titleId: 42, profileId: expect.any(String) }),
    ]);
    expect(data.ratings).toEqual([expect.objectContaining({ titleId: 42, rating: 5 })]);
    expect(data.device.activeProfileId).toBe(useLastFrameStore.getState().activeProfileId);
    expect(countExportItems(data)).toBe(data.profiles.length + 2);
  });

  it('uses the cloud snapshot without tombstones when signed in', () => {
    const snapshot: SyncSnapshot = {
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
      watchlist: [{ profileId: 'p1', titleId: 1, addedAt: 1, updatedAt: 1, deleted: true }],
      history: [
        {
          profileId: 'p1',
          titleId: 2,
          position: 10,
          duration: 100,
          lastWatchedAt: 1,
          completed: false,
          updatedAt: 1,
          deleted: false,
        },
      ],
      ratings: [],
    };
    const devices = [{ id: 'd1', label: 'Chrome on macOS', current: true }];
    const data = buildDataExport(useLastFrameStore.getState(), user, snapshot, new Date(), devices);
    expect(data.source).toBe('cloud');
    expect(data.devices).toEqual(devices);
    expect(data.account).toEqual({
      id: 'u1',
      email: 'ada@example.com',
      displayName: 'Ada',
      createdAt: '2026-10-01T00:00:00Z',
    });
    expect(data.watchlist).toEqual([]);
    expect(data.history).toHaveLength(1);
    expect(countExportItems(data)).toBe(2);
  });

  it('names the file by date', () => {
    expect(exportFileName(new Date('2026-10-06T23:59:00Z'))).toBe(
      'lastframe-export-2026-10-06.json',
    );
  });
});
