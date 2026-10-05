import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../../auth';
import { ToastProvider } from '../../../components/ui/Toast';
import { createMockAuth } from '../../../services/auth/mock';
import type { AuthService } from '../../../services/types';
import { useLastFrameStore } from '../../../state/store';
import ProfileMenu from '../ProfileMenu';

function renderMenu(service?: AuthService, path = '/title/movie/42?from=home') {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <ProfileMenu />
    </MemoryRouter>
  );
  render(
    service ? (
      <ToastProvider>
        <AuthProvider service={service} mode="mock" clearLocal={vi.fn()} startSync={null}>
          {tree}
        </AuthProvider>
      </ToastProvider>
    ) : (
      tree
    ),
  );
}

const open = () => fireEvent.click(screen.getByRole('button', { name: /switch profile/i }));

describe('ProfileMenu account items', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useLastFrameStore.setState({
        profiles: [{ id: 'p1', name: 'Me', avatar: '🎬', kid: false, createdAt: 1 }],
        activeProfileId: 'p1',
      });
    });
  });

  it('offers Account and Sign in to a guest, returning to the current page', async () => {
    renderMenu(createMockAuth());
    open();
    expect(await screen.findByRole('menuitem', { name: 'Account' })).toHaveAttribute(
      'href',
      '/account',
    );
    expect(screen.getByRole('menuitem', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?returnTo=%2Ftitle%2Fmovie%2F42%3Ffrom%3Dhome',
    );
    expect(screen.queryByRole('menuitem', { name: 'Sign out' })).toBeNull();
  });

  it('offers Account and Sign out when signed in, and signs out', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    renderMenu(service);
    open();
    const signOut = await screen.findByRole('menuitem', { name: 'Sign out' });
    expect(screen.getByRole('menuitem', { name: 'Account' })).toBeInTheDocument();
    fireEvent.click(signOut);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(await service.currentUser()).toBeNull();
    expect(await screen.findByText(/signed out/i)).toBeInTheDocument();
    open();
    expect(await screen.findByRole('menuitem', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('keeps the profile items only when rendered without auth', () => {
    renderMenu();
    open();
    expect(screen.getByRole('menuitem', { name: 'Manage profiles' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Account' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Sign in' })).toBeNull();
  });
});
