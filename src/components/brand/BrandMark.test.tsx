import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrandMark from './BrandMark';
import Lockup, { Wordmark } from './Lockup';
import { MARKS } from './marks';

describe('BrandMark', () => {
  it('renders each mark as a named image by default', () => {
    for (const m of MARKS) {
      const { unmount } = render(<BrandMark mark={m.id} />);
      const img = screen.getByRole('img', { name: `Lastframe.tv ${m.name} mark` });
      expect(img).toHaveAttribute('data-mark', m.id);
      expect(img.querySelectorAll('path').length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('is hidden when decorative and uses per-instance gradient ids', () => {
    const { container } = render(
      <>
        <BrandMark mark="frame" decorative />
        <BrandMark mark="frame" decorative />
      </>,
    );
    expect(screen.queryByRole('img')).toBeNull();
    const ids = Array.from(container.querySelectorAll('linearGradient')).map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-zA-Z0-9_-]+$/));
  });

  it('paints the tile background only for tile variants', () => {
    const { container, rerender } = render(<BrandMark mark="strip" decorative />);
    expect(container.querySelector('path[fill="#0b0b12"]')).toBeNull();
    rerender(<BrandMark mark="strip" variant="tile" decorative />);
    expect(container.querySelector('path[fill="#0b0b12"]')).not.toBeNull();
  });

  it('uses the chosen colourway stops', () => {
    const { container } = render(<BrandMark mark="countdown" colourway="ember" decorative />);
    const stops = Array.from(container.querySelectorAll('stop')).map((s) =>
      s.getAttribute('stop-color'),
    );
    expect(stops.slice(0, 2)).toEqual(['#f97316', '#e50914']);
  });
});

describe('Lockup', () => {
  it('is one image named after the brand, with a decorative mark and the wordmark', () => {
    render(<Lockup mark="monogram" size={48} />);
    const img = screen.getByRole('img', { name: 'Lastframe.tv' });
    expect(img).toHaveTextContent('LASTFRAME.TV');
    expect(img.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveStyle({ '--lf-size': '48px' });
  });

  it('can be decorative', () => {
    render(<Lockup mark="monogram" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('Wordmark renders the brand name in caps', () => {
    render(<Wordmark size={20} />);
    expect(screen.getByText('LASTFRAME.TV')).toHaveStyle({ fontSize: '20px' });
  });
});
