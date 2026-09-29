import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRovingFocus, type RovingFocusOptions } from './useRovingFocus';

function List({ labels, ...opts }: { labels: string[] } & RovingFocusOptions) {
  const { getItemProps } = useRovingFocus<HTMLButtonElement>(labels.length, opts);
  return (
    <div>
      {labels.map((l, i) => (
        <button key={l} {...getItemProps(i)}>
          {l}
        </button>
      ))}
    </div>
  );
}

const btn = (name: string) => screen.getByRole('button', { name });
const focus = (el: HTMLElement) => act(() => el.focus());

describe('useRovingFocus', () => {
  it('puts exactly one item in the tab order', () => {
    render(<List labels={['a', 'b', 'c']} />);
    expect(btn('a')).toHaveAttribute('tabindex', '0');
    expect(btn('b')).toHaveAttribute('tabindex', '-1');
    expect(btn('c')).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus with ArrowRight / ArrowLeft and moves the tab stop', () => {
    render(<List labels={['a', 'b', 'c']} />);
    focus(btn('a'));
    fireEvent.keyDown(btn('a'), { key: 'ArrowRight' });
    expect(btn('b')).toHaveFocus();
    expect(btn('b')).toHaveAttribute('tabindex', '0');
    expect(btn('a')).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(btn('b'), { key: 'ArrowLeft' });
    expect(btn('a')).toHaveFocus();
  });

  it('stops at the ends without loop, wraps with loop', () => {
    const { unmount } = render(<List labels={['a', 'b']} />);
    focus(btn('b'));
    fireEvent.keyDown(btn('b'), { key: 'ArrowRight' });
    expect(btn('b')).toHaveFocus();
    unmount();

    render(<List labels={['a', 'b']} loop />);
    focus(btn('b'));
    fireEvent.keyDown(btn('b'), { key: 'ArrowRight' });
    expect(btn('a')).toHaveFocus();
    fireEvent.keyDown(btn('a'), { key: 'ArrowLeft' });
    expect(btn('b')).toHaveFocus();
  });

  it('jumps with Home and End', () => {
    render(<List labels={['a', 'b', 'c', 'd']} />);
    focus(btn('b'));
    fireEvent.keyDown(btn('b'), { key: 'End' });
    expect(btn('d')).toHaveFocus();
    fireEvent.keyDown(btn('d'), { key: 'Home' });
    expect(btn('a')).toHaveFocus();
  });

  it('respects orientation', () => {
    render(<List labels={['a', 'b']} orientation="vertical" />);
    focus(btn('a'));
    fireEvent.keyDown(btn('a'), { key: 'ArrowRight' });
    expect(btn('a')).toHaveFocus();
    fireEvent.keyDown(btn('a'), { key: 'ArrowDown' });
    expect(btn('b')).toHaveFocus();
  });

  it('syncs the tab stop when an item is focused directly (click / screen reader)', () => {
    render(<List labels={['a', 'b', 'c']} />);
    fireEvent.focus(btn('c'));
    expect(btn('c')).toHaveAttribute('tabindex', '0');
    expect(btn('a')).toHaveAttribute('tabindex', '-1');
  });

  it('keeps the tab stop on a real item when the list shrinks', () => {
    const { rerender } = render(<List labels={['a', 'b', 'c']} />);
    focus(btn('c'));
    fireEvent.keyDown(btn('c'), { key: 'End' });
    rerender(<List labels={['a', 'b']} />);
    expect(btn('b')).toHaveAttribute('tabindex', '0');
  });

  it('ignores modified keys', () => {
    render(<List labels={['a', 'b']} />);
    focus(btn('a'));
    fireEvent.keyDown(btn('a'), { key: 'ArrowRight', altKey: true });
    expect(btn('a')).toHaveFocus();
  });
});
