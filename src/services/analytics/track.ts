import { analytics } from '../index';
import type { AnalyticsProps } from '../types';
import type { AnalyticsEventName } from './types';

export { AnalyticsEvents } from './types';

/** Fire-and-forget custom event through the active adapter. Never throws. */
export function track(event: AnalyticsEventName, props?: AnalyticsProps): void {
  try {
    analytics.track(event, props);
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
