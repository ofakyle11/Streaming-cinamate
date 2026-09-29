import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Hero, { SLIDE_INTERVAL_MS, TRAILER_DELAY_MS } from './Hero';
import { trailerVideoFromKey } from '../lib/trailer';
import { MOCK_GENRES, MOCK_TITLES, MOCK_VIDEOS } from '../services/tmdb/mock';
import { analytics, toMovie, type TmdbService, type TmdbVideo } from '../services';
import { ToastProvider } from './ui';
import { clearTrailerCache } from '../hooks/useTrailerKey';
import { selectIsInWatchlist, selectViews, useLastFrameStore } from '../state/store';

const byId = (id: number) =>
  toMovie(
    MOCK_TITLES.find((t) => t.id === id)!,
    MOCK_GENRES,
  );
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
  useLastFrameStore.setState({ watchlist: {}, views: {}, history: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
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

const heading = () => screen.getByRole('heading', { level: 1 });

describe('Hero actions', () => {
  it('Play opens the trailer dialog, records a trailer view and pauses the preview', async () => {
    const track = vi.spyOn(analytics, 'track');
    render(<Hero featured={[WITH_TRAILER, WITHOUT_TRAILER]} onMore={() => {}} />);
    await advance(TRAILER_DELAY_MS + 100);
    const iframe = screen.getByTestId('hero-trailer').querySelector('iframe')!;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post } });

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(`${WITH_TRAILER.title} trailer`);
    expect(dialog.querySelector('iframe')!.src).toContain('aqz-KE-bpKQ');

    const views = selectViews(useLastFrameStore.getState());
    expect(views).toHaveLength(1);
    expect(views[0].title.id).toBe(WITH_TRAILER.id);
    expect(views[0].trailerPlayedAt).toBeTypeOf('number');
    expect(track).toHaveBeenCalledWith(
      'trailer_open',
      expect.objectContaining({ source: 'hero', id: WITH_TRAILER.id }),
    );

    const sent = post.mock.calls.map(([msg]) => JSON.parse(msg as string).func);
    expect(sent).toEqual(expect.arrayContaining(['pauseVideo', 'mute']));

    // The carousel does not advance behind the dialog.
    await advance(SLIDE_INTERVAL_MS * 2);
    expect(heading()).toHaveTextContent(WITH_TRAILER.title);

    fireEvent.click(screen.getByRole('button', { name: 'Close trailer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(JSON.parse(post.mock.calls[post.mock.calls.length - 1][0] as string).func).toBe(
      'playVideo',
    );
  });

  it('Play looks up a trailer that has not resolved yet', async () => {
    render(<Hero featured={[WITH_TRAILER]} onMore={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await advance(500);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Play falls back to the title page when there is no trailer', async () => {
    const onOpenTitle = vi.fn();
    render(<Hero featured={[WITHOUT_TRAILER]} onMore={() => {}} onOpenTitle={onOpenTitle} />);
    await advance(500);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await advance(500);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onOpenTitle).toHaveBeenCalledWith(WITHOUT_TRAILER);
    expect(selectViews(useLastFrameStore.getState())).toHaveLength(0);
  });

  it('builds a YouTube video for the trailer modal from a key', () => {
    expect(trailerVideoFromKey('aqz-KE-bpKQ', 'Film')).toMatchObject({
      key: 'aqz-KE-bpKQ',
      site: 'YouTube',
      name: 'Film trailer',
    });
  });

  it('toggles the featured title in My List', () => {
    render(<Hero featured={[WITH_TRAILER]} onMore={() => {}} />);
    const btn = screen.getByRole('button', { name: /my list/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveTextContent('＋');

    fireEvent.click(btn);
    expect(selectIsInWatchlist(WITH_TRAILER.id)(useLastFrameStore.getState())).toBe(true);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveTextContent('✓');

    fireEvent.click(btn);
    expect(selectIsInWatchlist(WITH_TRAILER.id)(useLastFrameStore.getState())).toBe(false);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Hero slideshow', () => {
  // No trailers on these slides, so only the slideshow controls affect advancing.
  const slides = [WITHOUT_TRAILER, { ...WITHOUT_TRAILER, id: 99_999, title: 'Second Slide' }];

  it('auto-advances, and the pause button stops it', async () => {
    render(<Hero featured={slides} onMore={() => {}} />);
    expect(heading()).toHaveTextContent(slides[0].title);
    await advance(SLIDE_INTERVAL_MS + 10);
    expect(heading()).toHaveTextContent(slides[1].title);

    const pause = screen.getByRole('button', { name: 'Pause slideshow' });
    expect(pause).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pause);
    const play = screen.getByRole('button', { name: 'Play slideshow' });
    expect(play).toHaveAttribute('aria-pressed', 'true');

    await advance(SLIDE_INTERVAL_MS * 3);
    expect(heading()).toHaveTextContent(slides[1].title);

    fireEvent.click(play);
    await advance(SLIDE_INTERVAL_MS + 10);
    expect(heading()).toHaveTextContent(slides[0].title);
  });

  it('pauses while the pointer is over the card or focus is inside it', async () => {
    render(<Hero featured={slides} onMore={() => {}} />);
    const card = heading().closest('.hero-card')!;

    fireEvent.pointerEnter(card);
    await advance(SLIDE_INTERVAL_MS * 2);
    expect(heading()).toHaveTextContent(slides[0].title);
    fireEvent.pointerLeave(card);

    const moreInfo = screen.getByRole('button', { name: /more info/i });
    fireEvent.focus(moreInfo);
    await advance(SLIDE_INTERVAL_MS * 2);
    expect(heading()).toHaveTextContent(slides[0].title);

    fireEvent.blur(moreInfo);
    await advance(SLIDE_INTERVAL_MS + 10);
    expect(heading()).toHaveTextContent(slides[1].title);
  });

  it('never autoplays under reduced motion and hides the pause control', async () => {
    setReducedMotion(true);
    render(<Hero featured={slides} onMore={() => {}} />);
    await advance(SLIDE_INTERVAL_MS * 3);
    expect(heading()).toHaveTextContent(slides[0].title);
    expect(screen.queryByRole('button', { name: /slideshow/i })).not.toBeInTheDocument();
  });
});

describe('Hero trailer dialog footer', () => {
  async function openDialog() {
    render(
      <ToastProvider>
        <Hero featured={[WITH_TRAILER]} onMore={() => {}} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await advance(500); // mock trailer lookup resolves
    return screen.getByRole('dialog');
  }

  it('contains a My List toggle that updates the store', async () => {
    const dialog = await openDialog();
    const add = within(dialog).getByRole('button', { name: `Add ${WITH_TRAILER.title} to My List` });
    fireEvent.click(add);
    expect(selectIsInWatchlist(WITH_TRAILER.id)(useLastFrameStore.getState())).toBe(true);
    expect(
      within(dialog).getByRole('button', { name: `Remove ${WITH_TRAILER.title} from My List` }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('thumbs fire hero analytics and the title-page toast copy', async () => {
    const track = vi.spyOn(analytics, 'track');
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: `I like ${WITH_TRAILER.title}` }));
    expect(track).toHaveBeenCalledWith('thumb_up', {
      id: WITH_TRAILER.id,
      mediaType: WITH_TRAILER.mediaType,
      source: 'hero',
    });
    expect(screen.getByText(`Glad you liked ${WITH_TRAILER.title}`)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: `I like ${WITH_TRAILER.title}` }));
    expect(track).toHaveBeenCalledWith('thumb_clear', expect.objectContaining({ source: 'hero' }));
  });
});

describe('Hero carousel semantics', () => {
  const slides = [WITHOUT_TRAILER, { ...WITHOUT_TRAILER, id: 99_998, title: 'Second Slide' }];

  it('labels the carousel region and each slide "N of M"', async () => {
    render(<Hero featured={slides} onMore={() => {}} />);
    const region = screen.getByRole('region', { name: 'Featured titles' });
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    const slide = screen.getByRole('group', { name: `1 of 2: ${slides[0].title}` });
    expect(slide).toHaveAttribute('aria-roledescription', 'slide');

    await advance(SLIDE_INTERVAL_MS + 10);
    expect(screen.getByRole('group', { name: '2 of 2: Second Slide' })).toBeInTheDocument();
  });

  it('names the active dot "Showing <title>"', () => {
    render(<Hero featured={slides} onMore={() => {}} />);
    expect(screen.getByRole('button', { name: `Showing ${slides[0].title}` })).toHaveAttribute(
      'aria-current',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show Second Slide' }));
    expect(screen.getByRole('button', { name: 'Showing Second Slide' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Show ${slides[0].title}` })).toBeInTheDocument();
  });

  it('keeps the live region off while auto-advancing and polite after a dot click', async () => {
    render(<Hero featured={slides} onMore={() => {}} />);
    const live = screen.getByTestId('hero-live');
    expect(live).toHaveAttribute('aria-live', 'off');
    await advance(SLIDE_INTERVAL_MS + 10);
    expect(live).toHaveAttribute('aria-live', 'off');
    expect(live).toHaveTextContent('2 of 2: Second Slide');

    fireEvent.click(screen.getByRole('button', { name: `Show ${slides[0].title}` }));
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent(`1 of 2: ${slides[0].title}`);

    // The next automatic advance silences it again.
    await advance(SLIDE_INTERVAL_MS + 10);
    expect(live).toHaveAttribute('aria-live', 'off');
  });

  it('becomes polite when the user pauses, and off again on resume', () => {
    render(<Hero featured={slides} onMore={() => {}} />);
    const live = screen.getByTestId('hero-live');
    fireEvent.click(screen.getByRole('button', { name: 'Pause slideshow' }));
    expect(live).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }));
    expect(live).toHaveAttribute('aria-live', 'off');
  });
});

describe('Hero Play pending state', () => {
  it('ignores repeat clicks and shows a busy state while the lookup is pending', async () => {
    let resolve: (v: TmdbVideo[]) => void = () => {};
    const pending = new Promise<TmdbVideo[]>((r) => {
      resolve = r;
    });
    const videos = vi.fn(() => pending);
    const svc = { videos } as unknown as TmdbService;
    render(<Hero featured={[WITH_TRAILER]} onMore={() => {}} svc={svc} />);
    const before = videos.mock.calls.length; // background key lookup from useTrailerKey

    const play = screen.getByRole('button', { name: 'Play' });
    expect(play).not.toHaveAttribute('aria-busy');
    fireEvent.click(play);
    fireEvent.click(play);
    expect(videos).toHaveBeenCalledTimes(before + 1);
    expect(play).toHaveAttribute('aria-busy', 'true');
    expect(play).toHaveAttribute('aria-disabled', 'true');

    await act(async () => {
      resolve(MOCK_VIDEOS[WITH_TRAILER.id] ?? []);
      await pending;
    });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(play).not.toHaveAttribute('aria-busy');
    expect(videos).toHaveBeenCalledTimes(before + 1);
  });
});
