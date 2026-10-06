import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import { RETURN_TO_KEY } from '../auth/returnTo';
import { createMockAuth } from '../services/auth/mock';
import type { AdapterMode, AuthService } from '../services/types';
import SignInPage, { SENT_EMAIL_KEY } from './SignInPage';

function LocationProbe() {
  const loc = useLocation();
  return (
    <output data-testid="location">
      {loc.pathname + loc.search}
      {loc.state ? `|${JSON.stringify(loc.state)}` : ''}
    </output>
  );
}

interface Opts {
  service?: AuthService;
  mode?: AdapterMode;
  googleEnabled?: boolean;
}

function renderAt(
  url: string,
  { service = createMockAuth(), mode = 'mock', googleEnabled }: Opts = {},
) {
  const extra = googleEnabled === undefined ? {} : { googleEnabled };
  render(
    <AuthProvider service={service} mode={mode} clearLocal={vi.fn()} startSync={null}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/sign-in" element={<SignInPage {...extra} />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </AuthProvider>,
  );
  return { service };
}

const location = () => screen.getByTestId('location').textContent;
const emailField = () => screen.findByLabelText('Email');
const submit = () => screen.getByRole('button', { name: /sign-in link|send a new link/i });

/** A live-shaped adapter: sending the link does not sign the user in. */
function liveLikeAuth(): AuthService {
  const base = createMockAuth();
  return { ...base, signInWithMagicLink: vi.fn(async () => undefined) };
}

describe('SignInPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders the email-link form and no Google button by default', async () => {
    renderAt('/sign-in');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sign in to Lastframe.tv' }),
    ).toBeInTheDocument();
    expect(await emailField()).toHaveAttribute('type', 'email');
    expect(submit()).toHaveTextContent('Email me a sign-in link');
    expect(screen.queryByRole('button', { name: /google/i })).toBeNull();
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByText(/demo mode/i)).toBeInTheDocument();
  });

  it('shows the Google button only behind the flag', async () => {
    renderAt('/sign-in', { googleEnabled: true });
    expect(
      await screen.findByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
  });

  it('uses the "get started" wording for new visitors', async () => {
    renderAt('/sign-in?new=1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Get started with Lastframe.tv' }),
    ).toBeInTheDocument();
  });

  it('rejects an invalid email without calling the adapter', async () => {
    const { service } = renderAt('/sign-in');
    const spy = vi.spyOn(service, 'signInWithMagicLink');
    fireEvent.change(await emailField(), { target: { value: 'nope' } });
    fireEvent.click(submit());
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(spy).not.toHaveBeenCalled();
  });

  it('mock mode: signs in and returns to the page the user came from', async () => {
    renderAt('/sign-in?returnTo=%2Fmy-list%3Fsort%3Dnew');
    fireEvent.change(await emailField(), { target: { value: 'Ada@Example.com' } });
    fireEvent.click(submit());
    await waitFor(() => expect(location()).toBe('/my-list?sort=new'));
    expect(screen.getByText('elsewhere')).toBeInTheDocument();
  });

  it('never returns to another origin', async () => {
    renderAt('/sign-in?returnTo=https%3A%2F%2Fevil.example%2F');
    fireEvent.change(await emailField(), { target: { value: 'ada@example.com' } });
    fireEvent.click(submit());
    await waitFor(() => expect(location()).toBe('/'));
    expect(localStorage.getItem(RETURN_TO_KEY)).toBeNull();
  });

  it('live mode: sends the link, remembers the return path and moves to the sent page', async () => {
    const service = liveLikeAuth();
    renderAt('/sign-in?returnTo=%2Faccount', { service, mode: 'live' });
    fireEvent.change(await emailField(), { target: { value: 'ada@example.com' } });
    fireEvent.click(submit());
    await waitFor(() => expect(location()).toContain('/sign-in/sent'));
    expect(service.signInWithMagicLink).toHaveBeenCalledWith('ada@example.com');
    expect(location()).toContain('"email":"ada@example.com"');
    expect(location()).toContain('"returnTo":"/account"');
    expect(JSON.parse(localStorage.getItem(RETURN_TO_KEY) ?? '{}').path).toBe('/account');
    expect(sessionStorage.getItem(SENT_EMAIL_KEY)).toBe('ada@example.com');
  });

  it('surfaces an adapter failure and lets the user retry', async () => {
    const service = {
      ...createMockAuth(),
      signInWithMagicLink: vi.fn().mockRejectedValue(new Error('Mail is down')),
    };
    renderAt('/sign-in', { service, mode: 'live' });
    fireEvent.change(await emailField(), { target: { value: 'ada@example.com' } });
    fireEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('Mail is down');
    expect(submit()).toBeEnabled();
  });

  it('explains an expired link and offers a fresh one', async () => {
    renderAt('/sign-in?error=expired&email=ada%40example.com');
    expect(await screen.findByRole('alert')).toHaveTextContent(/that link has expired/i);
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(submit()).toHaveTextContent('Send a new link');
  });

  it('explains a link that did not work', async () => {
    renderAt('/sign-in?error=link');
    expect(await screen.findByRole('alert')).toHaveTextContent(/did not work/i);
  });

  it('sends a signed-in user straight on', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    renderAt('/sign-in?returnTo=%2Fplans', { service });
    await waitFor(() => expect(location()).toBe('/plans'));
  });
});
