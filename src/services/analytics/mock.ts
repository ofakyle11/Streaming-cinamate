import type { AnalyticsProps, AnalyticsService } from '../types';

export interface AnalyticsEvent {
  type: 'identify' | 'track' | 'page';
  name: string;
  props?: AnalyticsProps;
  at: string;
}

/**
 * Console/no-op analytics. Keeps a small ring buffer so a debug panel can
 * display recent events; logs to console only in dev builds.
 */
export function createMockAnalytics(opts: { debug?: boolean; bufferSize?: number } = {}): AnalyticsService & {
  events: () => readonly AnalyticsEvent[];
} {
  const debug = opts.debug ?? Boolean(import.meta.env.DEV);
  const max = opts.bufferSize ?? 100;
  const buffer: AnalyticsEvent[] = [];
  let userId: string | null = null;

  const push = (e: AnalyticsEvent) => {
    buffer.push(e);
    if (buffer.length > max) buffer.shift();
    if (debug) console.debug(`[analytics:${e.type}]`, e.name, { ...e.props, userId });
  };

  return {
    identify(id, traits) {
      userId = id;
      push({ type: 'identify', name: id ?? 'anonymous', props: traits, at: new Date().toISOString() });
    },
    track(event, props) {
      push({ type: 'track', name: event, props, at: new Date().toISOString() });
    },
    page(name, props) {
      push({ type: 'page', name, props, at: new Date().toISOString() });
    },
    events: () => buffer,
  };
}
