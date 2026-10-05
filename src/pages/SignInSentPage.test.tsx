import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import { createMockAuth } from '../services/auth/mock';
import type { AuthService } from '../services/types';
import { SENT_EMAIL_KEY } from './SignInPage';
import SignInSentPage from './SignInSentPage';

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

function liveLikeAuth(): AuthService {
  return { ...createMockAuth(), signInWithMagicLink: vi.fn(async () => undefined) };
}

function renderSent(state: unknown, service = liveLikeAuth(), cooldownSeconds = 3) {
  render(
    <AuthProvider service={service} mode="live" clearLocal={vi.fn()} startSync={null}>
      <MemoryRouter initialEntries={[{ pathname: '/sign-in/sent', state }]}>
        <Routes>
          <Route
            path="/sign-in/sent"
            element={<SignInSentPage cooldownSeconds={cooldownSeconds} />}
          />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </AuthProvider>,
  );
  return service;
}

const resend = () => screen.getByRole('button', { name: /resend link/i });

describe('SignInSentPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('shows the address and what to expect', async () => {
    renderSent({ email: 'ada@example.com', returnTo: '/my-list' });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Check your email' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText(/expires in 15 minutes/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /different email/i })).toHaveAttribute(
      'href',
      '/sign-in?returnTo=%2Fmy-list',
    );
  });

  it('counts down, then unlocks resend which sends again and restarts the timer', async () => {
    vi.useFakeTimers();
    const service = renderSent({ email: 'ada@example.com' });
    expect(resend()).toBeDisabled();
    expect(resend()).toHaveTextContent('Resend link in 0:03');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(resend()).toBeEnabled();
    expect(resend()).toHaveTextContent('Resend link');

    await act(async () => {
      fireEvent.click(resend());
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(service.signInWithMagicLink).toHaveBeenCalledWith('ada@example.com');
    expect(screen.getByText(/new link is on its way/i)).toBeInTheDocument();
    expect(resend()).toBeDisabled();
    expect(resend()).toHaveTextContent('0:03');
  });

  it('reports a resend failure', async () => {
    const service = {
      ...createMockAuth(),
      signInWithMagicLink: vi.fn().mockRejectedValue(new Error('Rate limited')),
    };
    renderSent({ email: 'ada@example.com' }, service, 0);
    fireEvent.click(await screen.findByRole('button', { name: /resend link/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Rate limited');
  });

  it('survives a reload through sessionStorage', async () => {
    sessionStorage.setItem(SENT_EMAIL_KEY, 'ada@example.com');
    renderSent(null);
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
  });

  it('goes back to sign-in when there is nothing to show', async () => {
    renderSent(null);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/sign-in'));
  });

  it('moves on once the link has signed the user in', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    renderSent({ email: 'ada@example.com', returnTo: '/account' }, service);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/account'));
  });
});
