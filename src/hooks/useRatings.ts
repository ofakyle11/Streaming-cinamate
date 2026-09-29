import { useShallow } from 'zustand/react/shallow';
import { selectRatingFor, selectRatings, useLastFrameStore, type TitleId } from '../state/store';

export function useRatings() {
  return useLastFrameStore(selectRatings);
}

export function useRatingFor(titleId: TitleId) {
  return useLastFrameStore(selectRatingFor(titleId));
}

export function useRatingActions() {
  return useLastFrameStore(
    useShallow((s) => ({
      rate: s.rateTitle,
      clear: s.clearRating,
    })),
  );
}
