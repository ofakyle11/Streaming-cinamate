import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LogoMark from './LogoMark';

describe('LogoMark', () => {
  it('renders as an img with an accessible title', () => {
    render(<LogoMark title="Last Frame logo" />);
    const img = screen.getByRole('img', { name: 'Last Frame logo' });
    expect(img.tagName.toLowerCase()).toBe('svg');
    expect(img).not.toHaveAttribute('aria-hidden');
    expect(img.querySelector('title')).toHaveTextContent('Last Frame logo');
  });

  it('defaults the accessible name to "Lastframe.tv" and applies size', () => {
    render(<LogoMark size={48} />);
    const img = screen.getByRole('img', { name: 'Lastframe.tv' });
    expect(img).toHaveAttribute('width', '48');
    expect(img).toHaveAttribute('height', '48');
  });

  it('is hidden from assistive tech when decorative', () => {
    const { container } = render(<LogoMark decorative title="ignored" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    expect(svg?.querySelector('title')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('uses unique gradient, mask and clip ids per instance', () => {
    const { container } = render(
      <>
        <LogoMark />
        <LogoMark variant="hero" />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('linearGradient, mask, clipPath')).map(
      (el) => el.id,
    );
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-zA-Z0-9_-]+$/));
  });

  it('wires the tile and band to its own mask, gradient and clip', () => {
    const { container } = render(<LogoMark />);
    const svg = container.querySelector('svg')!;
    const [gradId, bandId] = Array.from(svg.querySelectorAll('linearGradient')).map((g) => g.id);
    const lensId = svg.querySelector('mask')!.id;
    const clipId = svg.querySelector('clipPath')!.id;
    const tile = svg.querySelector('.logo-mark__tile')!;
    const band = svg.querySelector('.logo-mark__band')!;
    expect(tile).toHaveAttribute('fill', `url(#${gradId})`);
    expect(tile).toHaveAttribute('mask', `url(#${lensId})`);
    expect(band).toHaveAttribute('fill', `url(#${bandId})`);
    // The clip and mask live on the band's group, not the band, so they do not
    // travel with the sweep transform.
    expect(band).not.toHaveAttribute('clip-path');
    expect(band.parentElement).toHaveAttribute('clip-path', `url(#${clipId})`);
    expect(band.parentElement).toHaveAttribute('mask', `url(#${lensId})`);
    expect(svg.querySelector('mask .logo-mark__lens')).not.toBeNull();
  });

  it('defaults to the header variant with the load animation and no halo', () => {
    const { container } = render(<LogoMark className="extra" />);
    const root = container.firstElementChild!;
    expect(root).toHaveClass('logo-mark', 'logo-mark--header', 'extra');
    expect(root).toHaveAttribute('data-variant', 'header');
    expect(root).toHaveAttribute('data-animate', 'once');
    expect(root.querySelector('.logo-mark__halo')).toBeNull();
  });

  it('adds the halo layer behind the hero mark and exposes the animate mode', () => {
    const { container } = render(<LogoMark variant="hero" animate="hover" size={64} />);
    const root = container.firstElementChild!;
    expect(root).toHaveClass('logo-mark--hero');
    expect(root).toHaveAttribute('data-animate', 'hover');
    const halo = root.querySelector('.logo-mark__halo');
    expect(halo).toHaveAttribute('aria-hidden', 'true');
    // The halo sits before the svg in DOM order so it paints behind it.
    expect(root.firstElementChild).toBe(halo);
    expect(root.lastElementChild?.tagName.toLowerCase()).toBe('svg');
  });

  it('can render a still mark', () => {
    const { container } = render(<LogoMark animate="none" />);
    expect(container.firstElementChild).toHaveAttribute('data-animate', 'none');
  });
});

describe('brand.css motion contract', async () => {
  // vitest runs with css: false, which empties CSS imports (?raw included), so
  // the stylesheet is read from disk. Node's types are not in the app tsconfig.
  // @ts-expect-error node:fs has no type declarations in this project
  const { readFileSync } = (await import('node:fs')) as {
    readFileSync: (path: string, encoding: 'utf8') => string;
  };
  // Relative to the repo root, where vitest runs.
  const css = readFileSync('src/styles/brand.css', 'utf8');

  it('switches every animation and transition off under reduced motion', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toMatch(/animation:\s*none\s*!important/);
    expect(block).toMatch(/transition:\s*none\s*!important/);
    // The end frame of the halo: a brighter still, so the mark does not look switched off.
    expect(block).toMatch(/\.logo-mark__halo::before\s*\{\s*opacity:\s*0\.65\s*!important/);
  });

  it('only animates transform and opacity', () => {
    const keyframes = css.match(/@keyframes[\s\S]*?\n\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThan(0);
    for (const kf of keyframes) {
      const props = Array.from(kf.matchAll(/^\s+([a-z-]+):/gm), (m: RegExpMatchArray) => m[1]);
      expect(props.length).toBeGreaterThan(0);
      props.forEach((p) => expect(['transform', 'opacity']).toContain(p));
    }
    expect(css).not.toMatch(/transition:[^;]*(filter|box-shadow|width|height)/);
  });

  it('loops only the halo breathe', () => {
    const loops = css.match(/[a-z-]+\s[^;,]*infinite/g) ?? [];
    expect(loops.length).toBeGreaterThan(0);
    loops.forEach((l: string) => expect(l).toMatch(/lf-logo-breathe/));
  });

  it('keeps the old tilt and drop-shadow hover out', () => {
    expect(css).not.toMatch(/rotate\(/);
    expect(css).not.toMatch(/drop-shadow/);
  });
});
