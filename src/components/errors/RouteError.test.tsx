import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RouteError from './RouteError';

function renderWithLoaderError(thrown: unknown) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        loader: () => {
          throw thrown;
        },
        element: <p>Loaded</p>,
        errorElement: <RouteError />,
      },
    ],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('RouteError', () => {
  const originalLocation = window.location;
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // React Router logs caught loader errors; keep output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    reload = vi.fn();
    // jsdom's location.reload is non-configurable, so swap the whole object.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    vi.restoreAllMocks();
  });

  it('shows the 404 title and no retry for a 404 response', async () => {
    renderWithLoaderError(new Response('', { status: 404 }));
    expect(await screen.findByRole('heading', { name: /404/ })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });

  it('shows a retry button that reloads for a 500 response', async () => {
    renderWithLoaderError(new Response('', { status: 500 }));
    expect(await screen.findByRole('heading', { name: 'Error 500' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('offers Reload for a failed lazy-chunk import', async () => {
    renderWithLoaderError(
      new TypeError('Failed to fetch dynamically imported module: /assets/Detail.js'),
    );
    expect(
      await screen.findByRole('heading', { name: "Couldn't load this page" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows the fallback card for a generic error', async () => {
    renderWithLoaderError(new Error('kaboom'));
    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toHaveFocus();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
