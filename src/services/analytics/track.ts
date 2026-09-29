import { analytics } from '../index';
import type { AnalyticsProps, AnalyticsService } from '../types';
import { AnalyticsEvents, type AnalyticsEventName } from './types';

export { AnalyticsEvents };

/**
 * Fire-and-forget custom event through the active adapter (or an injected one,
 * e.g. in tests). Never throws.
 */
export function track(
  event: AnalyticsEventName,
  props?: AnalyticsProps,
  adapter: AnalyticsService = analytics,
): void {
  try {
    adapter.track(event, props);
  } catch {
    // Analytics must never break the UI.
  }
}

/** Fire-and-forget page view through the active adapter. Never throws. */
export function trackPage(name: string, props?: AnalyticsProps): void {
  try {
    analytics.page(name, props);
  } catch {
    // Analytics must never break the UI.
  }
}

/** Canonical event for a thumbs rating change (`null` = rating cleared). */
export function thumbEvent(thumb: 'up' | 'down' | null): AnalyticsEventName {
  return thumb === 'up' ? AnalyticsEvents.thumbUp : thumb === 'down' ? AnalyticsEvents.thumbDown : AnalyticsEvents.thumbClear;
}
