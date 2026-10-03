import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeToggle from './ThemeToggle';
import { setTheme } from '../../theme/useTheme';

const group = () => screen.getByRole('radiogroup', { name: 'Theme' });
const radio = (name: string) => within(group()).getByRole('radio', { name });

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    setTheme('system');
  });
  afterEach(() => vi.restoreAllMocks());

  it('is a radiogroup with System checked by default and one tab stop', () => {
    render(<ThemeToggle />);
    expect(radio('System')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Light')).toHaveAttribute('aria-checked', 'false');
    expect(radio('Dark')).toHaveAttribute('aria-checked', 'false');
    expect(radio('System')).toHaveAttribute('tabindex', '0');
    expect(radio('Light')).toHaveAttribute('tabindex', '-1');
    expect(radio('Dark')).toHaveAttribute('tabindex', '-1');
  });

  it('click selects, persists, applies to <html> and announces politely', () => {
    render(<ThemeToggle />);
    fireEvent.click(radio('Dark'));
    expect(radio('Dark')).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('lf.theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('status')).toHaveTextContent('Dark theme on');

    fireEvent.click(radio('System'));
    expect(localStorage.getItem('lf.theme')).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(screen.getByRole('status')).toHaveTextContent('Theme follows your device');
  });

  it('arrow keys move focus and select, wrapping at the ends', () => {
    render(<ThemeToggle />);
    const system = radio('System');
    system.focus();
    fireEvent.keyDown(system, { key: 'ArrowRight' });
    expect(radio('Light')).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(radio('Light'));
    expect(localStorage.getItem('lf.theme')).toBe('light');

    fireEvent.keyDown(radio('Light'), { key: 'ArrowRight' });
    expect(radio('Dark')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(radio('Dark'), { key: 'ArrowRight' });
    expect(radio('System')).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(radio('System'));

    fireEvent.keyDown(radio('System'), { key: 'ArrowLeft' });
    expect(radio('Dark')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(radio('Dark'), { key: 'Home' });
    expect(radio('System')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(radio('System'), { key: 'End' });
    expect(radio('Dark')).toHaveAttribute('aria-checked', 'true');
  });

  it('ignores modified keys and unrelated keys', () => {
    render(<ThemeToggle />);
    fireEvent.keyDown(radio('System'), { key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyDown(radio('System'), { key: 'Tab' });
    expect(radio('System')).toHaveAttribute('aria-checked', 'true');
  });

  it('reflects a saved preference on mount', () => {
    setTheme('light');
    render(<ThemeToggle />);
    expect(radio('Light')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Light')).toHaveAttribute('tabindex', '0');
  });

  it('uses a view transition from the pressed option when available', () => {
    const animate = vi.fn();
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return { ready: Promise.resolve() };
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });
    document.documentElement.animate =
      animate as unknown as typeof document.documentElement.animate;
    render(<ThemeToggle />);
    fireEvent.click(radio('Dark'));
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    return Promise.resolve().then(() => {
      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate.mock.calls[0][1]).toMatchObject({
        duration: 600,
        pseudoElement: '::view-transition-new(root)',
      });
      delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    });
  });

  it('swaps instantly under reduced motion', () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('reduced-motion'),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    const startViewTransition = vi.fn();
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });
    render(<ThemeToggle />);
    fireEvent.click(radio('Dark'));
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  });
});
