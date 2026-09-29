import { RefObject, useEffect, useRef } from 'react';

/** Elements that can receive keyboard focus. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Tabbable descendants of `root`, in DOM order (hidden / inert ones skipped). */
export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      !el.hasAttribute('inert') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      !el.closest('[inert]'),
  );
}

export interface FocusTrapOptions {
  /** Called when Escape is pressed while the trap is active. */
  onEscape?: () => void;
  /** Element to focus on activation; defaults to the first tabbable, then the container. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Return focus to the element that was focused before activation (default true). */
  restoreFocus?: boolean;
}

/**
 * Keeps keyboard focus inside `containerRef` while `active`:
 * - moves focus in on activation,
 * - wraps Tab / Shift+Tab at the edges (and pulls stray focus back in),
 * - calls `onEscape` on Escape,
 * - restores focus to the opener on deactivation / unmount.
 */
export function useFocusTrap<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  active = true,
  options: FocusTrapOptions = {},
): void {
  const { onEscape, initialFocus, restoreFocus = true } = options;
  // Keep the latest callback without re-running the effect (callers often pass inline arrows).
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFirst = () => {
      const target = initialFocus?.current ?? getFocusable(container)[0] ?? container;
      if (target === container && !container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      target.focus({ preventScroll: true });
    };
    if (!container.contains(document.activeElement)) focusFirst();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onEscapeRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onEscapeRef.current();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const items = getFocusable(container);
      if (items.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || !container.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !container.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Node && !container.contains(e.target)) focusFirst();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      if (restoreFocus && opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [active, containerRef, initialFocus, restoreFocus]);
}
