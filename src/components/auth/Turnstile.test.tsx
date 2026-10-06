import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Turnstile from './Turnstile';
import {
  isTurnstileEnabled,
  loadTurnstile,
  resetTurnstileLoader,
  turnstileSiteKey,
  type TurnstileApi,
} from '../../services/auth/turnstile';

afterEach(() => {
  delete window.turnstile;
  resetTurnstileLoader();
  document.head
    .querySelectorAll('script[src*="challenges.cloudflare.com"]')
    .forEach((s) => s.remove());
});

describe('turnstile config', () => {
  it('is off without a site key (mock mode)', () => {
    expect(turnstileSiteKey({})).toBeUndefined();
    expect(isTurnstileEnabled({ VITE_TURNSTILE_SITE_KEY: ' ' })).toBe(false);
    expect(turnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: ' 0x4AAA ' })).toBe('0x4AAA');
  });
});

describe('<Turnstile>', () => {
  it('renders nothing and loads no script without a site key', () => {
    const { container } = render(<Turnstile onToken={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(document.head.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
  });

  it('renders the widget and forwards tokens, expiry and cleanup', async () => {
    let opts: Parameters<TurnstileApi['render']>[1] | undefined;
    const api: TurnstileApi = {
      render: vi.fn((_el, o) => {
        opts = o;
        return 'w1';
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    };
    window.turnstile = api;
    const onToken = vi.fn();
    const { unmount } = render(<Turnstile siteKey="0xKEY" onToken={onToken} />);
    await waitFor(() => expect(api.render).toHaveBeenCalled());
    expect(opts).toMatchObject({ sitekey: '0xKEY', appearance: 'interaction-only' });
    opts?.callback?.('tok');
    expect(onToken).toHaveBeenLastCalledWith('tok');
    opts?.['expired-callback']?.();
    expect(onToken).toHaveBeenLastCalledWith(null);
    unmount();
    expect(api.remove).toHaveBeenCalledWith('w1');
  });

  it('clears the parent token when the widget resets (tokens are single use)', async () => {
    const api: TurnstileApi = { render: vi.fn(() => 'w1'), reset: vi.fn(), remove: vi.fn() };
    window.turnstile = api;
    const onToken = vi.fn();
    const { rerender } = render(<Turnstile siteKey="0xKEY" onToken={onToken} resetKey={0} />);
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    onToken.mockClear();
    rerender(<Turnstile siteKey="0xKEY" onToken={onToken} resetKey={1} />);
    expect(onToken).toHaveBeenCalledWith(null);
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(2));
  });

  it('retries with a fresh script after a failed load', async () => {
    const first = loadTurnstile();
    const dead = document.head.querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com"]',
    );
    dead?.dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow();
    expect(dead?.isConnected).toBe(false);
    const second = loadTurnstile();
    const fresh = document.head.querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com"]',
    );
    expect(fresh).not.toBeNull();
    expect(fresh).not.toBe(dead);
    window.turnstile = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };
    fresh?.dispatchEvent(new Event('load'));
    await expect(second).resolves.toBe(window.turnstile);
  });

  it('shows an error when the script cannot load', async () => {
    const onToken = vi.fn();
    render(<Turnstile siteKey="0xKEY" onToken={onToken} />);
    const script = document.head.querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com"]',
    );
    expect(script?.src).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    );
    script?.dispatchEvent(new Event('error'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not a bot/i);
    expect(onToken).toHaveBeenLastCalledWith(null);
  });
});
