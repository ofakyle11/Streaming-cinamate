import { useCallback, useState } from 'react';
import { isTurnstileEnabled } from '../services/auth/turnstile';
import type { MagicLinkOptions } from '../services/types';

export interface Captcha {
  /** True when this build has a Turnstile site key (live bot check). */
  required: boolean;
  /** True when the form may submit: no check needed, or a token is ready. */
  ready: boolean;
  /** Props for <Turnstile />. */
  widget: { onToken: (token: string | null) => void; resetKey: number };
  /** Options for signInWithMagicLink. */
  options(): MagicLinkOptions | undefined;
  /** Call after every send attempt: tokens are single use, so get a fresh one. */
  spend(): void;
}

/** Turnstile state for a form that sends a magic link. Inert in mock mode. */
export function useCaptcha(required: boolean = isTurnstileEnabled()): Captcha {
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const spend = useCallback(() => {
    setToken(null);
    setResetKey((n) => n + 1);
  }, []);
  return {
    required,
    ready: !required || token !== null,
    widget: { onToken: setToken, resetKey },
    options: () => (required && token ? { captchaToken: token } : undefined),
    spend,
  };
}
