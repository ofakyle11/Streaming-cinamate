import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastOptions, ToastProvider, useToast } from './Toast';

let api: ReturnType<typeof useToast>;

function Grab() {
  const ctx = useToast();
  useEffect(() => {
    api = ctx;
  }, [ctx]);
  return null;
}

function setup() {
  render(
    <ToastProvider>
      <Grab />
    </ToastProvider>,
  );
}

function show(message: string, opts?: ToastOptions) {
  let id = 0;
  act(() => {
    id = api.toast(message, opts);
  });
  return id;
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** The toast element (not just its text span). */
const toastEl = (message: string) => screen.getByText(message).closest('.toast') as HTMLElement;

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps both live regions mounted, with no role on individual toasts', () => {
    setup();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    show('Saved');
    expect(toastEl('Saved')).not.toHaveAttribute('role');
  });

  it('puts info and success toasts in the polite region', () => {
    setup();
    show('Added to list');
    show('Done', { kind: 'success' });
    const polite = screen.getByRole('status');
    expect(polite).toHaveAttribute('aria-live', 'polite');
    expect(within(polite).getByText('Added to list')).toBeInTheDocument();
    expect(within(polite).getByText('Done')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });

  it('puts error toasts in the assertive alert region', () => {
    setup();
    show('Network failed', { kind: 'error' });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(within(alert).getByText('Network failed')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('dismisses after its duration', () => {
    setup();
    show('Bye', { duration: 1000 });
    advance(999);
    expect(toastEl('Bye')).not.toHaveClass('leaving');
    advance(1);
    expect(toastEl('Bye')).toHaveClass('leaving');
    advance(300);
    expect(screen.queryByText('Bye')).not.toBeInTheDocument();
  });

  it('pauses on hover and resumes with the remaining time', () => {
    setup();
    show('Hover me', { duration: 1000 });
    advance(600);
    fireEvent.mouseEnter(toastEl('Hover me'));
    advance(5000);
    expect(toastEl('Hover me')).not.toHaveClass('leaving');
    fireEvent.mouseLeave(toastEl('Hover me'));
    advance(399);
    expect(toastEl('Hover me')).not.toHaveClass('leaving');
    advance(1);
    expect(toastEl('Hover me')).toHaveClass('leaving');
  });

  it('pauses while focus is inside and resumes when it leaves', () => {
    setup();
    show('Focus me', { duration: 1000 });
    advance(500);
    const button = within(toastEl('Focus me')).getByRole('button', { name: 'Dismiss' });
    act(() => button.focus());
    advance(5000);
    expect(toastEl('Focus me')).not.toHaveClass('leaving');
    act(() => button.blur());
    advance(499);
    expect(toastEl('Focus me')).not.toHaveClass('leaving');
    advance(1);
    expect(toastEl('Focus me')).toHaveClass('leaving');
  });

  it('stays paused while either hover or focus is active', () => {
    setup();
    show('Both', { duration: 1000 });
    const el = toastEl('Both');
    fireEvent.mouseEnter(el);
    act(() => within(el).getByRole('button').focus());
    fireEvent.mouseLeave(el);
    advance(5000);
    expect(toastEl('Both')).not.toHaveClass('leaving');
  });

  it('removes the toast when Dismiss is clicked', () => {
    setup();
    show('Close me', { duration: 0 });
    fireEvent.click(within(toastEl('Close me')).getByRole('button', { name: 'Dismiss' }));
    advance(300);
    expect(screen.queryByText('Close me')).not.toBeInTheDocument();
  });

  it('persists when duration is 0', () => {
    setup();
    show('Sticky', { duration: 0 });
    advance(60_000);
    expect(toastEl('Sticky')).not.toHaveClass('leaving');
  });

  it('dismiss(id) removes a toast programmatically', () => {
    setup();
    const id = show('Programmatic', { duration: 0 });
    act(() => api.dismiss(id));
    advance(300);
    expect(screen.queryByText('Programmatic')).not.toBeInTheDocument();
  });
});
