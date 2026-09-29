import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Services from '../services';
import TitlePage from './TitlePage';

const { loadHomeCatalog, realLoad } = vi.hoisted(() => ({
  loadHomeCatalog: vi.fn(),
  realLoad: { fn: null as null | typeof Services.loadHomeCatalog },
}));

vi.mock('../services', async (importOriginal) => {
  const actual = await importOriginal<typeof Services>();
  realLoad.fn = actual.loadHomeCatalog;
  return { ...actual, loadHomeCatalog };
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/title/:type/:id" element={<TitlePage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('TitlePage load states', () => {
  beforeEach(() => {
    loadHomeCatalog.mockReset();
  });

  it('shows the ErrorCard (not "Title not found") when loading fails, and retries', async () => {
    const catalog = await realLoad.fn!();
    const first = catalog.featured[0];
    loadHomeCatalog.mockRejectedValue(new TypeError('Failed to fetch'));
    renderAt(`/title/${first.mediaType}/${first.id}`);

    const alert = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(loadHomeCatalog).toHaveBeenCalledTimes(3);
    expect(alert).toHaveAccessibleName('Something went wrong');
    expect(screen.queryByText('Title not found')).not.toBeInTheDocument();
    await waitFor(() => expect(document.title).toMatch(/Something went wrong/));

    loadHomeCatalog.mockResolvedValue(catalog);
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { level: 1, name: first.title })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  }, 10000);

  it('shows "Title not found" for an unknown id', async () => {
    loadHomeCatalog.mockImplementation(() => realLoad.fn!());
    renderAt('/title/movie/999999999');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Title not found' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
