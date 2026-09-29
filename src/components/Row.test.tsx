import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Movie } from '../services/types';
import Row from './Row';
import { ROW_SCROLL_STEP, measureTrack } from './rowTrack';

function movie(id: number): Movie {
  return {
    id,
    mediaType: 'movie',
    title: `Title ${id}`,
    year: 2021,
    rating: 'PG',
    match: 88,
    genres: ['Drama'],
    description: '',
    poster: `/p/${id}.jpg`,
    backdrop: `/b/${id}.jpg`,
    runtime: 90,
  };
}

const ITEMS = [1, 2, 3, 4, 5, 6].map(movie);

const originalMatchMedia = window.matchMedia;
const originalIO = globalThis.IntersectionObserver;
const proto = HTMLElement.prototype as HTMLElement & { scrollBy: HTMLElement['scrollBy'] };
const originalScrollBy = proto.scrollBy;

function setReducedMotion(reduce: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/** jsdom has no layout; give every element an overflowing 300px-wide viewport onto 1200px of content. */
function fakeOverflow() {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1200);
}

function renderRow(title = 'Trending Now') {
  return render(
    <MemoryRouter>
      <Row title={title} items={ITEMS} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setReducedMotion(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  window.matchMedia = originalMatchMedia;
  globalThis.IntersectionObserver = originalIO;
  proto.scrollBy = originalScrollBy;
});

describe('Row', () => {
  it('names the region by its title', () => {
    renderRow('Trending Now');
    const region = screen.getByRole('region', { name: 'Trending Now' });
    expect(region.tagName).toBe('SECTION');
  });

  it('wires the arrows to the track as buttons', () => {
    fakeOverflow();
    renderRow();
    const left = screen.getByRole('button', { name: /scroll trending now left/i });
    const right = screen.getByRole('button', { name: /scroll trending now right/i });
    const trackId = left.getAttribute('aria-controls');
    expect(trackId).toBeTruthy();
    expect(right).toHaveAttribute('aria-controls', trackId);
    expect(document.getElementById(trackId!)).toHaveClass('track');
    expect(left).toHaveAttribute('type', 'button');
    expect(right).toHaveAttribute('type', 'button');
  });

  it('disables the left arrow at the start and enables the right arrow when content overflows', () => {
    fakeOverflow();
    renderRow();
    expect(screen.getByRole('button', { name: /left/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /right/i })).toHaveAttribute('aria-disabled', 'false');
  });

  it('hides the arrows when the content does not overflow', () => {
    renderRow();
    // jsdom reports zero widths: nothing to scroll, so both arrows are hidden.
    expect(screen.queryByRole('button', { name: /left/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /right/i })).toBeNull();
  });

  it('scrolls with behavior "auto" when reduced motion is requested', () => {
    setReducedMotion(true);
    fakeOverflow();
    const scrollBy = vi.fn();
    proto.scrollBy = scrollBy;
    renderRow();
    fireEvent.click(screen.getByRole('button', { name: /right/i }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 300 * ROW_SCROLL_STEP, behavior: 'auto' });
  });

  it('scrolls smoothly by default and ignores presses on a disabled arrow', () => {
    fakeOverflow();
    const scrollBy = vi.fn();
    proto.scrollBy = scrollBy;
    renderRow();
    fireEvent.click(screen.getByRole('button', { name: /left/i }));
    expect(scrollBy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /right/i }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 300 * ROW_SCROLL_STEP, behavior: 'smooth' });
  });

  it('updates arrow state on scroll', async () => {
    fakeOverflow();
    const scrollLeft = vi.spyOn(HTMLElement.prototype, 'scrollLeft', 'get').mockReturnValue(0);
    renderRow();
    const track = document.querySelector('.track')!;
    scrollLeft.mockReturnValue(900);
    await act(async () => {
      fireEvent.scroll(track);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(screen.getByRole('button', { name: /left/i })).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByRole('button', { name: /right/i })).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders visible straight away without IntersectionObserver', () => {
    // @ts-expect-error simulate an environment without IntersectionObserver
    delete globalThis.IntersectionObserver;
    renderRow();
    expect(screen.getByRole('region', { name: 'Trending Now' })).toHaveClass('in');
  });

  it('stays hidden until intersecting when IntersectionObserver exists', () => {
    renderRow();
    expect(screen.getByRole('region', { name: 'Trending Now' })).not.toHaveClass('in');
  });
});

describe('measureTrack', () => {
  it('reports start, middle, end and no-overflow states', () => {
    expect(measureTrack({ scrollLeft: 0, scrollWidth: 1000, clientWidth: 400 })).toEqual({
      overflows: true,
      atStart: true,
      atEnd: false,
    });
    expect(measureTrack({ scrollLeft: 300, scrollWidth: 1000, clientWidth: 400 })).toEqual({
      overflows: true,
      atStart: false,
      atEnd: false,
    });
    expect(measureTrack({ scrollLeft: 599.5, scrollWidth: 1000, clientWidth: 400 })).toEqual({
      overflows: true,
      atStart: false,
      atEnd: true,
    });
    expect(measureTrack({ scrollLeft: 0, scrollWidth: 400, clientWidth: 400 })).toEqual({
      overflows: false,
      atStart: true,
      atEnd: true,
    });
  });
});
