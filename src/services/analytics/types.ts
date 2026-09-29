/**
 * Analytics contract (re-exported from the shared service types) plus the
 * canonical event names the app emits. Adapters: `mock.ts` (default, logs to
 * console in dev) and `plausible.ts` (enabled by VITE_PLAUSIBLE_DOMAIN).
 */
export type { AnalyticsProps, AnalyticsService } from '../types';

/** Custom events. Keep names stable: dashboards/goals key off them. */
export const AnalyticsEvents = {
  search: 'search',
  addToList: 'add-to-list',
  playTrailer: 'play-trailer',
  titleOpen: 'title-open',
  removeFromList: 'remove-from-list',
  thumbUp: 'thumb-up',
  thumbDown: 'thumb-down',
  thumbClear: 'thumb-clear',
  historyClear: 'history-clear',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
