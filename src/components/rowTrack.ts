/** Scroll-range helpers for the Row carousel. */

/** Fraction of the visible track width scrolled per arrow press. */
export const ROW_SCROLL_STEP = 0.85;
/** Sub-pixel tolerance so fractional scroll positions still count as the start/end. */
const EDGE_EPSILON = 2;

export interface TrackState {
  overflows: boolean;
  atStart: boolean;
  atEnd: boolean;
}

/** Pure helper: where is the track relative to its scrollable range? */
export function measureTrack(el: Pick<HTMLElement, 'scrollLeft' | 'scrollWidth' | 'clientWidth'>): TrackState {
  const max = el.scrollWidth - el.clientWidth;
  const overflows = max > EDGE_EPSILON;
  // RTL layouts report negative scrollLeft; use its magnitude.
  const pos = Math.abs(el.scrollLeft);
  return {
    overflows,
    atStart: !overflows || pos <= EDGE_EPSILON,
    atEnd: !overflows || pos >= max - EDGE_EPSILON,
  };
}

export const sameTrackState = (a: TrackState, b: TrackState) =>
  a.overflows === b.overflows && a.atStart === b.atStart && a.atEnd === b.atEnd;
