import { useEffect, useRef, useState } from 'react';
import { loadTurnstile, turnstileSiteKey, type TurnstileApi } from '../../services/auth/turnstile';
import { useTheme } from '../../theme';
import '../../styles/auth.css';

/** One fixed message for every failure path (script blocked, challenge failed). */
export const TURNSTILE_ERROR_MESSAGE =
  "We couldn't confirm you're not a bot. Reload the page and try again.";

export interface TurnstileProps {
  /**
   * Receives the verification token, or null when it expired or errored.
   * Pass it to signInWithMagicLink(email, { captchaToken }).
   */
  onToken: (token: string | null) => void;
  /** Bumping this resets the widget (e.g. after a failed submit). */
  resetKey?: number;
  /** Defaults to the app's current theme (not the device setting), read once at mount. */
  theme?: 'auto' | 'light' | 'dark';
  /** Override the env-derived site key (tests). */
  siteKey?: string;
  className?: string;
}

/**
 * Cloudflare Turnstile widget for the sign-in form. Renders nothing at all when
 * no site key is configured (mock mode, previews), so the form must treat a
 * missing token as "not required": use `isTurnstileEnabled()` to decide
 * whether to wait for one (from services/auth/turnstile).
 *
 * Placement: put it directly above the submit button. The widget is
 * interaction-only, so it is usually empty and only grows (about 65px) when
 * Cloudflare needs a click; don't rely on a flex/grid `gap` slot around it.
 */
export default function Turnstile({
  onToken,
  resetKey = 0,
  theme,
  siteKey,
  className,
}: TurnstileProps) {
  const key = siteKey ?? turnstileSiteKey();
  const hostRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);
  const [error, setError] = useState<string | null>(null);
  // Read the theme once: re-rendering the widget on a theme toggle would drop its token.
  const { resolved } = useTheme();
  const themeRef = useRef(theme ?? resolved);

  useEffect(() => {
    const host = hostRef.current;
    if (!key || !host) return;
    // A (re)render invalidates any earlier token: Turnstile tokens are single use.
    onTokenRef.current(null);
    let api: TurnstileApi | null = null;
    let widgetId: string | null = null;
    let cancelled = false;
    setError(null);
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        api = turnstile;
        widgetId = turnstile.render(host, {
          sitekey: key,
          theme: themeRef.current,
          appearance: 'interaction-only',
          size: 'flexible',
          callback: (token) => {
            setError(null);
            onTokenRef.current(token);
          },
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => {
            onTokenRef.current(null);
            setError(TURNSTILE_ERROR_MESSAGE);
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        onTokenRef.current(null);
        setError(TURNSTILE_ERROR_MESSAGE);
      });
    return () => {
      cancelled = true;
      if (api && widgetId) {
        try {
          api.remove(widgetId);
        } catch {
          /* already gone */
        }
      }
      host.replaceChildren();
    };
  }, [key, resetKey]);

  if (!key) return null;
  return (
    <div className={className} data-testid="turnstile">
      <div ref={hostRef} />
      {error && (
        <p role="alert" className="turnstile-error">
          {error}
        </p>
      )}
    </div>
  );
}
