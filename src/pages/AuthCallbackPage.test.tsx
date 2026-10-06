import { StrictMode, type ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import { RETURN_TO_KEY, rememberReturnTo } from '../auth/returnTo';
import { createMockAuth } from '../services/auth/mock';
import type { AdapterMode, AuthService } from '../services/types';
import AuthCallbackPage from './AuthCallbackPage';
import { bootAuthCallback, clearAuthCallback, readAuthCallback } from '../auth/callbackBoot';

/** Simulate main.tsx's boot capture for a real browser URL. */
function captureAt(url: string) {
  window.history.replaceState(null, '', url);
  bootAuthCallback();
}

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search + loc.hash}</output>;
}

function renderAt(
  url: string,
  service: AuthService = createMockAuth(),
  mode: AdapterMode = 'mock',
  strict = false,
) {
  const Wrap = strict ? StrictMode : ({ children }: { children: ReactNode }) => <>{children}</>;
  render(
    <Wrap>
      <AuthProvider service={service} mode={mode} clearLocal={vi.fn()} startSync={null}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage timeoutMs={50} />} />
            <Route path="*" element={<p>elsewhere</p>} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </AuthProvider>
    </Wrap>,
  );
}

const location = () => screen.getByTestId('location').textContent;

describe('AuthCallbackPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('continues to the remembered page once signed in, and forgets it', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    rememberReturnTo('/title/movie/42');
    renderAt('/auth/callback#access_token=abc&type=magiclink', service);
    await waitFor(() => expect(location()).toBe('/title/movie/42'));
    expect(localStorage.getItem(RETURN_TO_KEY)).toBeNull();
  });

  it('keeps the remembered page under StrictMode double rendering (main.tsx uses it)', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    rememberReturnTo('/plans');
    renderAt('/auth/callback#access_token=abc', service, 'mock', true);
    await waitFor(() => expect(location()).toBe('/plans'));
    expect(localStorage.getItem(RETURN_TO_KEY)).toBeNull();
  });

  it('falls back to the home page with nothing remembered', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    renderAt('/auth/callback', service);
    await waitFor(() => expect(location()).toBe('/'));
  });

  it('sends an expired link back to sign-in with the reason and the return path', async () => {
    rememberReturnTo('/my-list');
    renderAt(
      '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    await waitFor(() => expect(location()).toBe('/sign-in?error=expired&returnTo=%2Fmy-list'));
  });

  it('sends any other failed link back as a bad link', async () => {
    renderAt('/auth/callback?error=invalid_request');
    await waitFor(() => expect(location()).toBe('/sign-in?error=link'));
  });

  it('mock mode: a guest landing here goes to sign-in', async () => {
    renderAt('/auth/callback');
    await waitFor(() => expect(location()).toBe('/sign-in?error=link'));
  });

  it('live mode: waits for the session, then gives up', async () => {
    vi.useFakeTimers();
    renderAt('/auth/callback#access_token=never-resolves', createMockAuth(), 'live');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('heading', { level: 1, name: /signing you in/i })).toBeInTheDocument();
    expect(location()).toContain('/auth/callback');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(location()).toBe('/sign-in?error=link');
  });

  describe('with the tokens captured at boot (main.tsx)', () => {
    afterEach(() => {
      clearAuthCallback();
      window.history.replaceState(null, '', '/');
    });

    it('exchanges them through completeSignIn, then continues and forgets them', async () => {
      captureAt('/auth/callback?code=pkce-1');
      expect(window.location.search).toBe('');
      const service = createMockAuth();
      const user = {
        id: 'u1',
        email: 'ada@example.com',
        displayName: 'Ada',
        createdAt: '2026-01-01',
      };
      // Like the live SDK: the exchange creates the session the provider then sees.
      const completeSignIn = vi.fn(async () => {
        await service.signInWithMagicLink(user.email);
        return user;
      });
      rememberReturnTo('/my-list');
      renderAt('/auth/callback', { ...service, completeSignIn }, 'live', true);
      await waitFor(() => expect(location()).toBe('/my-list'));
      expect(completeSignIn).toHaveBeenCalledTimes(1);
      expect(completeSignIn).toHaveBeenCalledWith({ code: 'pkce-1' });
      expect(readAuthCallback()).toBeNull();
    });

    it('sends a link the adapter rejects back to sign-in', async () => {
      captureAt('/auth/callback#access_token=a&refresh_token=r');
      const completeSignIn = vi.fn().mockRejectedValue(new Error('used'));
      renderAt('/auth/callback', { ...createMockAuth(), completeSignIn }, 'live');
      await waitFor(() => expect(location()).toBe('/sign-in?error=link'));
      expect(readAuthCallback()).toBeNull();
    });

    it('reads a provider error from the captured params', async () => {
      captureAt('/auth/callback#error=access_denied&error_code=otp_expired');
      expect(window.location.hash).toBe('');
      const completeSignIn = vi.fn();
      renderAt('/auth/callback', { ...createMockAuth(), completeSignIn }, 'live');
      await waitFor(() => expect(location()).toBe('/sign-in?error=expired'));
      expect(completeSignIn).not.toHaveBeenCalled();
    });
  });
});
