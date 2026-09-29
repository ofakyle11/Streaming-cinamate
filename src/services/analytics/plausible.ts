import type { AnalyticsProps, AnalyticsService } from './types';

/** Plausible's documented queue signature: `plausible(event, { u?, props? })`. */
export type PlausibleOptions = { u?: string; props?: Record<string, string | number | boolean> };
export type PlausibleFn = ((event: string, opts?: PlausibleOptions) => void) & { q?: unknown[] };

export type PlausibleWindow = Window & { plausible?: PlausibleFn };

export interface PlausibleConfig {
  /** Site domain as registered in Plausible (VITE_PLAUSIBLE_DOMAIN). Public config, not a secret. */
  domain: string;
  /** Self-hosted / proxied Plausible host (VITE_PLAUSIBLE_API_HOST); defaults to the hosted service. */
  apiHost?: string;
  /** Injectable for tests; defaults to the global window (absent during SSR). */
  win?: PlausibleWindow;
}

export const DEFAULT_PLAUSIBLE_HOST = 'https://plausible.io';
export const PLAUSIBLE_SCRIPT_ID = 'plausible-analytics';

/** Plausible only accepts string/number/boolean props; drop null/undefined. */
export function toPlausibleProps(props?: AnalyticsProps): Record<string, string | number | boolean> | undefined {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function resolveWindow(win?: PlausibleWindow): PlausibleWindow | undefined {
  if (win) return win;
  return typeof window === 'undefined' ? undefined : (window as PlausibleWindow);
}

/**
 * Plausible adapter. Loads the "manual" script (page views are sent by us on
 * route change) by creating a <script> element; calls made before it loads are
 * queued on `window.plausible.q`, which the script drains on load. No user ids
 * are sent: `identify` is a deliberate no-op. Without a window/document
 * (SSR, node tests) every method is a safe no-op.
 */
export function createPlausibleAnalytics(config: PlausibleConfig): AnalyticsService {
  const customHost = config.apiHost?.trim();
  const host = (customHost || DEFAULT_PLAUSIBLE_HOST).replace(/\/+$/, '');
  let lastPageUrl: string | null = null;

  const ensure = (): PlausibleFn | undefined => {
    const win = resolveWindow(config.win);
    if (!win || !win.document) return undefined;

    if (typeof win.plausible !== 'function') {
      const queue: PlausibleFn = (...args: unknown[]) => {
        (queue.q = queue.q ?? []).push(args);
      };
      win.plausible = queue;
    }

    const doc = win.document;
    if (!doc.getElementById(PLAUSIBLE_SCRIPT_ID)) {
      const script = doc.createElement('script');
      script.id = PLAUSIBLE_SCRIPT_ID;
      script.defer = true;
      script.src = `${host}/js/script.manual.js`;
      script.setAttribute('data-domain', config.domain);
      if (customHost) script.setAttribute('data-api', `${host}/api/event`);
      (doc.head ?? doc.body)?.appendChild(script);
    }
    return win.plausible;
  };

  const send = (event: string, opts?: PlausibleOptions) => {
    try {
      const fn = ensure();
      if (!fn) return;
      if (opts) fn(event, opts);
      else fn(event);
    } catch {
      // Analytics must never break the app.
    }
  };

  return {
    identify() {
      // Plausible is cookieless and anonymous; never forward user ids/traits.
    },
    track(event, props) {
      const p = toPlausibleProps(props);
      send(event, p ? { props: p } : undefined);
    },
    page(name, props) {
      const win = resolveWindow(config.win);
      if (!win?.location) return;
      const path =
        typeof props?.path === 'string' ? props.path : `${win.location.pathname}${win.location.search}`;
      const url = `${win.location.origin}${path}`;
      // Components may also report named pages; count each URL once per visit to it.
      if (url === lastPageUrl) return;
      lastPageUrl = url;
      const rest: AnalyticsProps = { ...props, page: name };
      delete rest.path;
      const p = toPlausibleProps(rest);
      send('pageview', p ? { u: url, props: p } : { u: url });
    },
  };
}
