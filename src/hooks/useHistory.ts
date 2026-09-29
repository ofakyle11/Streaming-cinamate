import { useShallow } from 'zustand/react/shallow';
import {
  selectContinueWatching,
  selectHistory,
  selectHistoryFor,
  useLastFrameStore,
  type TitleId,
} from '../state/store';

/** Full watch history for the active profile, most recent first. */
export function useHistory() {
  return useLastFrameStore(selectHistory);
}

/** In-progress titles for the active profile (shallow-compared to avoid re-render loops). */
export function useContinueWatching() {
  return useLastFrameStore(useShallow(selectContinueWatching));
}

export function useHistoryFor(titleId: TitleId) {
  return useLastFrameStore(selectHistoryFor(titleId));
}

export function useHistoryActions() {
  return useLastFrameStore(
    useShallow((s) => ({
      recordProgress: s.recordProgress,
      markCompleted: s.markCompleted,
      clear: s.clearHistory,
    })),
  );
}
