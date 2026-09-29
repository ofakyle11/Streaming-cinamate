import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Hero, { TRAILER_DELAY_MS } from './Hero';
import { MOCK_GENRES, MOCK_TITLES } from '../services/tmdb/mock';
import { toMovie } from '../services';
import { clearTrailerCache } from '../hooks/useTrailerKey';

const byId = (id: number) => toMovie(MOCK_TITLES.find((t) => t.id === id)!, MOCK_GENRES);
/** 1000 has a YouTube trailer in the mock fixtures; 1028 has none. */
const WITH_TRAILER = byId(1000);
const WITHOUT_TRAILER = byId(1028);

const originalMatchMedia = window.matchMedia;

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

/** Advance fake time and flush the mock adapter's promise chain. */
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  clearTrailerCache();
  setReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

describe('Hero trailer preview', () => {
  it('fades in a muted YouTube embed after the dwell delay', async () => {
    render(<Hero featured={[WITH_TRAILER, WITHOUT_TRAILER]} onMore={() => {}} />);
    await advance(TRAILER_DELAY_MS - 500);
    expect(screen.queryByTestId('hero-trailer')).not.toBeInTheDocument();

    await advance(600);
    const wrapper = screen.getByTestId('hero-trailer');
    const iframe = wrapper.querySelector('iframe')!;
    expect(iframe.src).toContain('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ');
    expect(iframe.src).toContain('mute=1');
    expect(iframe.src).toContain('autoplay=1');
    expect(wrapper).not.toHaveClass('ready');

    fireEvent.load(iframe);
    expect(wrapper).toHaveClass('ready');
  });

  it('toggles mute via the IFrame API without reloading the embed', async () => {
    render(<Hero featured={[WITH_TRAILER]} onMore={() => {}} />);
    await advance(TRAILER_DELAY_MS + 100);
    const iframe = screen.getByTestId('hero-trailer').querySelector('iframe')!;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post } });
    const src = iframe.src;

    fireEvent.click(screen.getByRole('button', { name: 'Unmute trailer' }));
    expect(post).toHaveBeenLastCalledWith(
      JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
      'https://www.youtube-nocookie.com',
    );
    const muteBtn = screen.getByRole('button', { name: 'Mute trailer' });
    expect(muteBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(muteBtn);
    expect(post).toHaveBeenLastCalledWith(
      JSON.stringify({ event: 'command', func: 'mute', args: [] }),
      'https://www.youtube-nocookie.com',
    );
    expect(iframe.src).toBe(src);
  });

  it('renders no embed or mute toggle when the title has no trailer', async () => {
    render(<Hero featured={[WITHOUT_TRAILER, WITH_TRAILER]} onMore={() => {}} />);
    await advance(TRAILER_DELAY_MS + 500);
    expect(screen.queryByTestId('hero-trailer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mute trailer/i })).not.toBeInTheDocument();
  });

  it('drops the embed when switching slides and restarts the delay', async () => {
    render(<Hero featured={[WITH_TRAILER, WITHOUT_TRAILER]} onMore={() => {}} />);
    await advance(TRAILER_DELAY_MS + 100);
    expect(screen.getByTestId('hero-trailer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: `Show ${WITHOUT_TRAILER.title}` }));
    expect(screen.queryByTestId('hero-trailer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: `Show ${WITH_TRAILER.title}` }));
    expect(screen.queryByTestId('hero-trailer')).not.toBeInTheDocument();
    await advance(TRAILER_DELAY_MS + 100);
    expect(screen.getByTestId('hero-trailer')).toBeInTheDocument();
  });

  it('never autoplays under prefers-reduced-motion, but allows an explicit preview', async () => {
    setReducedMotion(true);
    render(<Hero featured={[WITH_TRAILER, WITHOUT_TRAILER]} onMore={() => {}} />);
    await advance(TRAILER_DELAY_MS * 4);
    expect(screen.queryByTestId('hero-trailer')).not.toBeInTheDocument();
    // Carousel does not auto-advance either.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(WITH_TRAILER.title);

    fireEvent.click(screen.getByRole('button', { name: 'Play trailer preview' }));
    expect(screen.getByTestId('hero-trailer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop trailer preview' }));
    expect(screen.queryByTestId('hero-trailer')).not.toBeInTheDocument();
  });

  it('renders nothing for an empty feature list', () => {
    const { container } = render(<Hero featured={[]} onMore={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
