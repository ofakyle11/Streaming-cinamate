/**
 * Cloudflare Turnstile (bot check on the sign-in form).
 *
 * Off unless VITE_TURNSTILE_SITE_KEY is set at build time, so mock mode and
 * previews never load a third-party script. The site key is public by design;
 * the matching secret key lives only in Supabase (Auth → Bot and Abuse
 * Protection), which verifies the token we pass as `captchaToken`.
 */

/** Script origin; also the CSP entry scripts/security-headers.mjs adds when enabled. */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
export const TURNSTILE_SCRIPT_URL = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;

export interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: (code?: string) => void;
  'expired-callback'?: () => void;
  theme?: 'auto' | 'light' | 'dark';
  appearance?: 'always' | 'execute' | 'interaction-only';
  size?: 'normal' | 'flexible' | 'compact';
}

export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function turnstileSiteKey(
  env: Record<string, unknown> = import.meta.env,
): string | undefined {
  const key = env.VITE_TURNSTILE_SITE_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : undefined;
}

export function isTurnstileEnabled(env?: Record<string, unknown>): boolean {
  return Boolean(turnstileSiteKey(env));
}

let scriptPromise: Promise<TurnstileApi> | null = null;

/**
 * Loads the Turnstile script once and resolves with the API. Rejects (and
 * allows a retry) when the script fails to load, e.g. offline or blocked.
 */
export function loadTurnstile(doc: Document = document): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
      const existing = doc.querySelector<HTMLScriptElement>(
        `script[src="${TURNSTILE_SCRIPT_URL}"]`,
      );
      const script = existing ?? doc.createElement('script');
      const fail = (msg: string) => {
        scriptPromise = null;
        // Drop the dead element so a retry injects a fresh one instead of waiting on it forever.
        script.remove();
        reject(new Error(msg));
      };
      const onLoad = () =>
        window.turnstile ? resolve(window.turnstile) : fail('Turnstile did not initialise.');
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', () => fail('Could not load the bot check.'), { once: true });
      if (!existing) {
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        doc.head.appendChild(script);
      }
    });
  }
  return scriptPromise;
}

/** Test hook: forget a previous load attempt. */
export function resetTurnstileLoader(): void {
  scriptPromise = null;
}
