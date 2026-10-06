import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../../auth';
import { ToastProvider } from '../../../components/ui/Toast';
import { createMockAuth } from '../../../services/auth/mock';
import type { AuthService } from '../../../services/types';
import { useLastFrameStore } from '../../../state/store';
import ProfileMenu from '../ProfileMenu';

function renderMenu(service?: AuthService, path = '/title/movie/42') {
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

  it('shows no account items to a guest (the bar offers Sign in instead)', async () => {
    renderMenu(createMockAuth());
    open();
    expect(await screen.findByRole('menuitem', { name: 'Manage profiles' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Account' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /sign/i })).toBeNull();
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
  });

  it('keeps the profile items only when rendered without auth', () => {
    renderMenu();
    open();
    expect(screen.getByRole('menuitem', { name: 'Manage profiles' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Account' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Sign in' })).toBeNull();
  });
});
