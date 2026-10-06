import type { LastFrameState } from '../state/store';
import type { SyncSnapshot, User } from '../services/types';

/**
 * "Download my data": everything Lastframe.tv keeps for you, as one JSON file.
 * Signed in, the synced tables come from the cloud snapshot (profiles, My
 * List, history, ratings); as a guest, or when there is no cloud copy, the
 * same tables come from this device. Views and thumbs only ever live on the
 * device, so they are always read locally.
 */
export interface DataExport {
  format: 'lastframe.tv/export';
  version: 1;
  exportedAt: string;
  /** Where the synced tables came from. */
  source: 'cloud' | 'device';
  account: { id: string; email: string; displayName: string; createdAt: string } | null;
  profiles: unknown[];
  watchlist: unknown[];
  history: unknown[];
  ratings: unknown[];
  /** Device-only data (not synced). */
  device: {
    activeProfileId: string | null;
    thumbs: LastFrameState['thumbs'];
    views: LastFrameState['views'];
  };
}

const flatten = <T>(per: Record<string, T[]>): Array<T & { profileId: string }> =>
  Object.entries(per).flatMap(([profileId, list]) => list.map((row) => ({ profileId, ...row })));

export function buildDataExport(
  state: LastFrameState,
  user: User | null,
  snapshot: SyncSnapshot | null,
  now: Date = new Date(),
): DataExport {
  const live = (rows: Array<{ deleted: boolean }>) => rows.filter((r) => !r.deleted);
  return {
    format: 'lastframe.tv/export',
    version: 1,
    exportedAt: now.toISOString(),
    source: snapshot ? 'cloud' : 'device',
    account: user
      ? { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt }
      : null,
    profiles: snapshot ? live(snapshot.profiles) : state.profiles,
    watchlist: snapshot ? live(snapshot.watchlist) : flatten(state.watchlist),
    history: snapshot ? live(snapshot.history) : flatten(state.history),
    ratings: snapshot ? live(snapshot.ratings) : flatten(state.ratings),
    device: { activeProfileId: state.activeProfileId, thumbs: state.thumbs, views: state.views },
  };
}

/** `lastframe-export-2026-10-06.json` */
export function exportFileName(now: Date = new Date()): string {
  return `lastframe-export-${now.toISOString().slice(0, 10)}.json`;
}

/** Saved items across the synced tables, for the confirmation line. */
export function countExportItems(data: DataExport): number {
  return data.profiles.length + data.watchlist.length + data.history.length + data.ratings.length;
}

/** Trigger a browser download of the JSON. Returns false when the browser cannot (no Blob/URL). */
export function downloadJson(data: unknown, fileName: string, doc: Document = document): boolean {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    doc.body.appendChild(a);
    a.click();
    a.remove();
    // Give the click a tick before revoking so Safari starts the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
