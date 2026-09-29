import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getFocusable, useFocusTrap } from './useFocusTrap';

function Dialog({
  onEscape,
  withFocusables = true,
}: {
  onEscape?: () => void;
  withFocusables?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, { onEscape });
  return (
    <div ref={ref} role="dialog" aria-label="Test dialog">
      {withFocusables && (
        <>
          <button>first</button>
          <button disabled>disabled</button>
          <a href="#x">middle</a>
          <button>last</button>
        </>
      )}
    </div>
  );
}

function Harness({ withFocusables = true }: { withFocusables?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      <button>outside</button>
      {open && <Dialog onEscape={() => setOpen(false)} withFocusables={withFocusables} />}
    </>
  );
}

const btn = (name: string) => screen.getByRole('button', { name });

describe('useFocusTrap', () => {
  it('moves focus into the container on activation', () => {
    render(<Harness />);
    btn('open').focus();
    fireEvent.click(btn('open'));
    expect(btn('first')).toHaveFocus();
  });

  it('wraps Tab from last to first and Shift+Tab from first to last', () => {
    render(<Harness />);
    fireEvent.click(btn('open'));
    btn('last').focus();
    fireEvent.keyDown(btn('last'), { key: 'Tab' });
    expect(btn('first')).toHaveFocus();
    fireEvent.keyDown(btn('first'), { key: 'Tab', shiftKey: true });
    expect(btn('last')).toHaveFocus();
  });

  it('does not interfere with Tab in the middle of the container', () => {
    render(<Harness />);
    fireEvent.click(btn('open'));
    const ev = fireEvent.keyDown(btn('first'), { key: 'Tab' });
    // fireEvent returns false when preventDefault was called.
    expect(ev).toBe(true);
  });

  it('pulls stray focus back inside', () => {
    render(<Harness />);
    fireEvent.click(btn('open'));
    btn('outside').focus();
    expect(btn('first')).toHaveFocus();
  });

  it('calls onEscape on Escape and restores focus to the opener', () => {
    render(<Harness />);
    btn('open').focus();
    fireEvent.click(btn('open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(btn('open')).toHaveFocus();
  });

  it('focuses the container itself when it has nothing tabbable', () => {
    render(<Harness withFocusables={false} />);
    fireEvent.click(btn('open'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog).toHaveFocus();
  });

  it('does nothing when inactive', () => {
    const onEscape = vi.fn();
    function Inactive() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref, false, { onEscape });
      return (
        <div ref={ref}>
          <button>inside</button>
        </div>
      );
    }
    render(<Inactive />);
    expect(btn('inside')).not.toHaveFocus();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('getFocusable skips disabled, tabindex=-1 and aria-hidden elements', () => {
    const root = document.createElement('div');
    const a = document.createElement('button');
    a.textContent = 'a';
    const b = document.createElement('button');
    b.disabled = true;
    const c = document.createElement('span');
    c.tabIndex = -1;
    const d = document.createElement('input');
    d.setAttribute('aria-hidden', 'true');
    const e = document.createElement('span');
    e.tabIndex = 0;
    root.append(a, b, c, d, e);
    expect(getFocusable(root)).toEqual([a, e]);
  });
});
