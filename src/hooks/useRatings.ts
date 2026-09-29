import { useShallow } from 'zustand/react/shallow';
import type { MediaType } from '../services/types';
import { selectRatingFor, selectRatingForTitle, selectRatings, useLastFrameStore, type TitleId } from '../state/store';

export function useRatings() {
  return useLastFrameStore(selectRatings);
}

/** Star rating for a title; pass `mediaType` so a movie and a series sharing an id stay separate. */
export function useRatingFor(titleId: TitleId, mediaType?: MediaType) {
  return useLastFrameStore(mediaType ? selectRatingForTitle(titleId, mediaType) : selectRatingFor(titleId));
}

export function useRatingActions() {
  return useLastFrameStore(
    useShallow((s) => ({
      rate: s.rateTitle,
      clear: s.clearRating,
    })),
  );
}
