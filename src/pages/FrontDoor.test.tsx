import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue, type AuthStatus } from '../auth/context';
import { GUEST_KEY, rememberGuest } from '../lib/guest';
import FrontDoor from './FrontDoor';

vi.mock('./Home', () => ({ default: () => <p>home app</p> }));
vi.mock('./LandingPage', () => ({ default: () => <p>landing page</p> }));

function renderDoor(status: AuthStatus) {
  const value = {
    status,
    user: null,
    isGuest: status !== 'authenticated',
    mode: 'mock',
    signInWithMagicLink: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    deleteData: vi.fn(),
  } as unknown as AuthContextValue;
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter>
        <Suspense fallback={<p>suspense</p>}>
          <FrontDoor />
        </Suspense>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => {
  window.localStorage.removeItem(GUEST_KEY);
});

describe('FrontDoor', () => {
  it('shows the landing page to a signed-out first-time visitor', async () => {
    renderDoor('guest');
    expect(await screen.findByText('landing page')).toBeInTheDocument();
  });

  it('shows the app once the visitor chose to browse as a guest', async () => {
    rememberGuest();
    renderDoor('guest');
    expect(await screen.findByText('home app')).toBeInTheDocument();
  });

  it('shows the app to a signed-in user', async () => {
    renderDoor('authenticated');
    expect(await screen.findByText('home app')).toBeInTheDocument();
  });

  it('draws neither while auth is still resolving', () => {
    renderDoor('loading');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('landing page')).toBeNull();
    expect(screen.queryByText('home app')).toBeNull();
  });

  it('switches to the app in place when the guest choice is made', async () => {
    renderDoor('guest');
    expect(await screen.findByText('landing page')).toBeInTheDocument();
    rememberGuest();
    expect(await screen.findByText('home app')).toBeInTheDocument();
  });
});
