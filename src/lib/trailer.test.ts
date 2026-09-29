import { describe, expect, it } from 'vitest';
import { isYouTubeKey, pickTrailerKey, youTubeCommand, youTubeEmbedUrl } from './trailer';
import type { TmdbVideo } from '../services/types';
import { createMockTmdb, MOCK_VIDEOS } from '../services/tmdb/mock';

const v = (over: Partial<TmdbVideo>): TmdbVideo => ({
  id: 'x',
  key: 'aqz-KE-bpKQ',
  name: 'Trailer',
  site: 'YouTube',
  type: 'Trailer',
  ...over,
});

describe('isYouTubeKey', () => {
  it('accepts 11-char ids and rejects anything else', () => {
    expect(isYouTubeKey('aqz-KE-bpKQ')).toBe(true);
    expect(isYouTubeKey('short')).toBe(false);
    expect(isYouTubeKey('aqz-KE-bpKQ"><script>')).toBe(false);
    expect(isYouTubeKey('../../evil1')).toBe(false);
    expect(isYouTubeKey(undefined)).toBe(false);
  });
});

describe('pickTrailerKey', () => {
  it('returns null for empty input', () => {
    expect(pickTrailerKey([])).toBeNull();
    expect(pickTrailerKey(undefined)).toBeNull();
  });

  it('ignores non-YouTube sites, non-trailer types and malformed keys', () => {
    expect(
      pickTrailerKey([
        v({ site: 'Vimeo', key: '12345678901' }),
        v({ type: 'Featurette', key: 'AAAAAAAAAAA' }),
        v({ key: 'bad key!!' }),
      ]),
    ).toBeNull();
  });

  it('prefers official trailers over teasers', () => {
    const key = pickTrailerKey([
      v({ type: 'Teaser', key: 'TTTTTTTTTTT', official: true }),
      v({ type: 'Trailer', key: 'UUUUUUUUUUU', official: false }),
      v({ type: 'Trailer', key: 'OOOOOOOOOOO', official: true }),
    ]);
    expect(key).toBe('OOOOOOOOOOO');
  });

  it('falls back to a teaser', () => {
    expect(pickTrailerKey([v({ type: 'Teaser', key: 'TTTTTTTTTTT' })])).toBe('TTTTTTTTTTT');
  });
});

describe('youTubeEmbedUrl', () => {
  it('builds a muted, looping, privacy-enhanced autoplay URL', () => {
    const url = new URL(youTubeEmbedUrl('aqz-KE-bpKQ', 'https://lastframe.tv'));
    expect(url.origin).toBe('https://www.youtube-nocookie.com');
    expect(url.pathname).toBe('/embed/aqz-KE-bpKQ');
    expect(url.searchParams.get('autoplay')).toBe('1');
    expect(url.searchParams.get('mute')).toBe('1');
    expect(url.searchParams.get('loop')).toBe('1');
    expect(url.searchParams.get('playlist')).toBe('aqz-KE-bpKQ');
    expect(url.searchParams.get('enablejsapi')).toBe('1');
    expect(url.searchParams.get('origin')).toBe('https://lastframe.tv');
  });

  it('refuses invalid keys', () => {
    expect(() => youTubeEmbedUrl('javascript:alert(1)')).toThrow();
  });

  it('serialises IFrame API commands', () => {
    expect(JSON.parse(youTubeCommand('unMute'))).toEqual({ event: 'command', func: 'unMute', args: [] });
  });
});

describe('mock tmdb.videos', () => {
  const svc = createMockTmdb();

  it('returns fixture trailers that resolve to a key', async () => {
    const videos = await svc.videos('movie', 1000);
    expect(videos).toEqual(MOCK_VIDEOS[1000]);
    expect(pickTrailerKey(videos)).toBe('aqz-KE-bpKQ');
  });

  it('returns [] for titles without trailers or mismatched media type', async () => {
    expect(await svc.videos('movie', 1028)).toEqual([]);
    expect(await svc.videos('tv', 1000)).toEqual([]);
  });

  it('only contains valid YouTube keys for YouTube entries', () => {
    for (const list of Object.values(MOCK_VIDEOS)) {
      for (const video of list.filter((x) => x.site === 'YouTube')) expect(isYouTubeKey(video.key)).toBe(true);
    }
  });
});
