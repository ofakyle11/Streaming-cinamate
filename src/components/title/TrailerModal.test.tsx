import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TmdbVideo } from '../../services';
import { MOCK_VIDEOS } from '../../services/tmdb/mock';
import TrailerModal from './TrailerModal';

const video = (over: Partial<TmdbVideo>): TmdbVideo => ({
  id: 'v',
  key: 'aqz-KE-bpKQ',
  name: 'Official Trailer',
  site: 'YouTube',
  type: 'Trailer',
  official: true,
  ...over,
});

function renderModal(v: TmdbVideo, onClose = vi.fn()) {
  render(<TrailerModal video={v} title="Neon Drift" poster="https://example.test/p.jpg" onClose={onClose} />);
  return onClose;
}

describe('TrailerModal', () => {
  it('embeds a real YouTube trailer from the mock fixtures on the privacy-enhanced domain', () => {
    const yt = MOCK_VIDEOS[1000].find((v) => v.site === 'YouTube')!;
    renderModal(yt);
    const frame = screen.getByTitle('Neon Drift trailer');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('src')).toMatch(
      new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${yt.key}\\?`),
    );
    expect(screen.queryByText(/can’t be played here/i)).not.toBeInTheDocument();
  });

  it.each([
    ['an unsupported site', video({ site: 'Dailymotion', key: 'x8abc12' })],
    ['an unsafe key', video({ key: '../evil?x=1' })],
  ])('falls back to a placeholder card for %s', (_label, v) => {
    renderModal(v);
    expect(screen.queryByTitle('Neon Drift trailer')).not.toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/can’t be played here/i)).toBeInTheDocument();
  });

  it('closes via the close button and on backdrop click, not on dialog click', () => {
    const onClose = renderModal(video({}));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /close trailer/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
