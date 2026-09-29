import { useShallow } from 'zustand/react/shallow';
import type { MediaType } from '../services/types';
import { selectThumbFor, selectThumbForTitle, selectThumbs, useLastFrameStore, type TitleId } from '../state/store';

/** Active profile's thumbs up/down entries (w2-ratings). */
export function useThumbs() {
  return useLastFrameStore(selectThumbs);
}

/** Thumb for a title; pass `mediaType` so a movie and a series sharing an id stay separate. */
export function useThumbFor(titleId: TitleId, mediaType?: MediaType) {
  return useLastFrameStore(mediaType ? selectThumbForTitle(titleId, mediaType) : selectThumbFor(titleId));
}

export function useThumbActions() {
  return useLastFrameStore(useShallow((s) => ({ setThumb: s.setThumb })));
}
