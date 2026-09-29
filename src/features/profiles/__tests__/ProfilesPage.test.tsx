import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '../../../components/ui';
import ProfilesPage from '../../../pages/ProfilesPage';
import ProfileMenu from '../ProfileMenu';
import { selectWatchlist, useLastFrameStore } from '../../../state/store';

const initial = useLastFrameStore.getState();

function reset() {
  const me = { id: 'me', name: 'Me', avatar: '🎬', kid: false, createdAt: 1 };
  useLastFrameStore.setState(
    { ...initial, profiles: [me], activeProfileId: 'me', watchlist: {}, history: {}, ratings: {} },
    true,
  );
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/profiles']}>
        <ProfileMenu />
        <Routes>
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="/" element={<p>home page</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('ProfilesPage', () => {
  beforeEach(reset);

  it("shows the Who's watching? grid", () => {
    renderPage();
    expect(screen.getByRole('heading', { name: "Who's watching?" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Watch as Me, current profile/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add profile' })).toBeInTheDocument();
  });

  it('adds a kids profile with a chosen avatar, then switches to it', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Add profile' }));
    const dialog = screen.getByRole('dialog', { name: 'Add profile' });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: '  Kiddo ' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Meadow' }));
    fireEvent.click(within(dialog).getByRole('switch'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add profile' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const kiddo = useLastFrameStore.getState().profiles.find((p) => p.name === 'Kiddo');
    expect(kiddo).toMatchObject({ avatar: 'meadow', kid: true });

    fireEvent.click(screen.getByRole('button', { name: 'Watch as Kiddo (kids)' }));
    expect(useLastFrameStore.getState().activeProfileId).toBe(kiddo?.id);
    expect(screen.getByText('home page')).toBeInTheDocument();
  });

  it('rejects duplicate names', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Add profile' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'me' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add profile' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('already uses that name');
    expect(useLastFrameStore.getState().profiles).toHaveLength(1);
  });

  it('edits and deletes profiles in manage mode, never the last one', () => {
    act(() => {
      useLastFrameStore.getState().addProfile({ name: 'Guest', avatar: 'gold' });
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Manage profiles' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Guest' }));
    let dialog = screen.getByRole('dialog', { name: 'Edit profile' });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Visitor' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(useLastFrameStore.getState().profiles.map((p) => p.name)).toEqual(['Me', 'Visitor']);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Visitor' }));
    dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete profile' }));
    expect(useLastFrameStore.getState().profiles.map((p) => p.name)).toEqual(['Me']);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Me' }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('hides the add tile at the profile limit', () => {
    act(() => {
      for (const name of ['B', 'C', 'D', 'E']) useLastFrameStore.getState().addProfile({ name });
    });
    renderPage();
    expect(screen.queryByRole('button', { name: 'Add profile' })).not.toBeInTheDocument();
    expect(screen.getByText(/up to 5 profiles/)).toBeInTheDocument();
  });
});

describe('ProfileMenu', () => {
  beforeEach(reset);

  it('shows the active profile and switches per-profile state', () => {
    act(() => {
      useLastFrameStore.getState().toggleWatchlist(42);
      useLastFrameStore.getState().addProfile({ name: 'Ada', avatar: 'rose', kid: true });
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Profile: Me/ }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitemradio', { name: /Me/ })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Ada/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Profile: Ada \(kids\)/ })).toBeInTheDocument();
    expect(selectWatchlist(useLastFrameStore.getState())).toEqual([]);

    act(() => {
      useLastFrameStore.getState().setActiveProfile('me');
    });
    expect(selectWatchlist(useLastFrameStore.getState()).map((e) => e.titleId)).toEqual([42]);
  });

  it('closes on Escape', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Profile: Me/ }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('store: removeProfile guard', () => {
  beforeEach(reset);

  it('never removes the last profile', () => {
    useLastFrameStore.getState().removeProfile('me');
    expect(useLastFrameStore.getState().profiles).toHaveLength(1);
    expect(useLastFrameStore.getState().activeProfileId).toBe('me');
  });
});
