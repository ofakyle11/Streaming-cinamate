import { useShallow } from 'zustand/react/shallow';
import { selectIsInWatchlist, selectWatchlist, useLastFrameStore, type TitleId } from '../state/store';

/** Watchlist entries for the active profile, newest first. */
export function useWatchlist() {
  return useLastFrameStore(selectWatchlist);
}

export function useIsInWatchlist(titleId: TitleId) {
  return useLastFrameStore(selectIsInWatchlist(titleId));
}

export function useWatchlistActions() {
  return useLastFrameStore(
    useShallow((s) => ({
      add: s.addToWatchlist,
      remove: s.removeFromWatchlist,
      toggle: s.toggleWatchlist,
    })),
  );
}
