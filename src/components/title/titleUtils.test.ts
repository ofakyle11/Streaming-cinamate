import { describe, expect, it } from 'vitest';
import type { TmdbVideo } from '../../services';
import { hasOffers, initials, trailerEmbedUrl } from './titleUtils';

const v = (site: string, key: string): TmdbVideo => ({
  id: '1',
  key,
  name: 'T',
  site,
  type: 'Trailer',
  official: true,
});

describe('trailerEmbedUrl', () => {
  it('builds privacy-friendly YouTube and Vimeo embeds', () => {
    expect(trailerEmbedUrl(v('YouTube', 'abc_DEF-12'))).toBe(
      'https://www.youtube-nocookie.com/embed/abc_DEF-12?autoplay=1&rel=0&modestbranding=1',
    );
    expect(trailerEmbedUrl(v('YouTube', 'abc'), false)).toContain('autoplay=0');
    expect(trailerEmbedUrl(v('Vimeo', '12345'))).toBe(
      'https://player.vimeo.com/video/12345?autoplay=1&dnt=1',
    );
  });

  it('rejects unknown sites and unsafe keys', () => {
    expect(trailerEmbedUrl(v('Mock', 'lf-1000'))).toBeNull();
    expect(trailerEmbedUrl(v('YouTube', '../evil?x=1'))).toBeNull();
    expect(trailerEmbedUrl(v('YouTube', ''))).toBeNull();
  });
});

describe('initials', () => {
  it('takes up to two letters', () => {
    expect(initials('Mara Vale')).toBe('MV');
    expect(initials('Northern Lights TV')).toBe('NL');
    expect(initials('Lumen+')).toBe('L');
    expect(initials('')).toBe('');
  });
});

describe('hasOffers', () => {
  it('is true only when some offer group is non-empty', () => {
    expect(hasOffers(null)).toBe(false);
    expect(hasOffers({ region: 'US', link: '' })).toBe(false);
    expect(hasOffers({ region: 'US', link: '', rent: [] })).toBe(false);
    expect(
      hasOffers({
        region: 'CA',
        link: '',
        buy: [{ provider_id: 1, provider_name: 'X', logo_path: '', display_priority: 1 }],
      }),
    ).toBe(true);
  });
});
