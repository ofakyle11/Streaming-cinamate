import { useEffect, useRef, useState } from 'react';
import { loadTurnstile, turnstileSiteKey, type TurnstileApi } from '../../services/auth/turnstile';

export interface TurnstileProps {
  /**
   * Receives the verification token, or null when it expired or errored.
   * Pass it to signInWithMagicLink(email, { captchaToken }).
   */
  onToken: (token: string | null) => void;
  /** Bumping this resets the widget (e.g. after a failed submit). */
  resetKey?: number;
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
 */
export default function Turnstile({
  onToken,
  resetKey = 0,
  theme = 'auto',
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

  useEffect(() => {
    const host = hostRef.current;
    if (!key || !host) return;
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
          theme,
          appearance: 'interaction-only',
          size: 'flexible',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => {
            onTokenRef.current(null);
            setError('The bot check failed to load. Reload the page and try again.');
          },
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onTokenRef.current(null);
        setError(err instanceof Error ? err.message : 'Could not load the bot check.');
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
  }, [key, theme, resetKey]);

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
