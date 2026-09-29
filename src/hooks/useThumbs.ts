import { useShallow } from 'zustand/react/shallow';
import { selectThumbFor, selectThumbs, useLastFrameStore, type TitleId } from '../state/store';

/** Active profile's thumbs up/down entries (w2-ratings). */
export function useThumbs() {
  return useLastFrameStore(selectThumbs);
}

export function useThumbFor(titleId: TitleId) {
  return useLastFrameStore(selectThumbFor(titleId));
}

export function useThumbActions() {
  return useLastFrameStore(useShallow((s) => ({ setThumb: s.setThumb })));
}
