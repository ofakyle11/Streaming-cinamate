import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { continueWatching, recentlyViewed, viewToMovie, type ViewEntry } from '../lib/viewHistory';
import type { Movie } from '../services/types';
import { selectHistory, selectViews, useLastFrameStore } from '../state/store';

/** Every viewed title for the active profile, most recent first. */
export function useViews(): ViewEntry[] {
  return useLastFrameStore(selectViews);
}

export interface HistoryRows {
  continueWatching: Movie[];
  recentlyViewed: Movie[];
}

/** Home rows derived from the view log (+ playback progress), memoised per store change. */
export function useHistoryRows(): HistoryRows {
  const views = useLastFrameStore(selectViews);
  const playback = useLastFrameStore(selectHistory);
  return useMemo(() => {
    const cw = continueWatching(views, playback);
    return {
      continueWatching: cw.map(viewToMovie),
      recentlyViewed: recentlyViewed(views, cw).map(viewToMovie),
    };
  }, [views, playback]);
}

export function useViewActions() {
  const actions = useLastFrameStore(
    useShallow((s) => ({
      recordView: s.recordView,
      removeView: s.removeView,
      clearViews: s.clearViews,
      clearHistory: s.clearHistory,
      restoreView: s.restoreView,
    })),
  );
  return useMemo(
    () => ({
      recordView: actions.recordView,
      removeView: actions.removeView,
      /** Clears viewed titles and playback progress for the active profile. */
      clearAll: () => {
        actions.clearViews();
        actions.clearHistory();
      },
      /** Undo a removal with the exact captured entry (keeps position, counts and timestamps). */
      restoreView: actions.restoreView,
    }),
    [actions],
  );
}
