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

  it('defaults the accessible name to "Last Frame" and applies size', () => {
    render(<LogoMark size={48} />);
    const img = screen.getByRole('img', { name: 'Last Frame' });
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

  it('uses unique gradient ids per instance', () => {
    const { container } = render(
      <>
        <LogoMark />
        <LogoMark />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('linearGradient')).map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-zA-Z0-9_-]+$/));
  });
});
