import { useEffect, type RefObject } from 'react';

/** Phone and tablet: dialogs render as bottom sheets (theme.css modal block). */
export const SHEET_QUERY = '(max-width: 1024px)';
/** Drag further than this (px) and the sheet is dismissed on release. */
export const SHEET_DISMISS_DISTANCE = 96;
/** Flick faster than this (px/ms) and the sheet is dismissed regardless of distance. */
export const SHEET_DISMISS_VELOCITY = 0.6;

interface Options {
  /** Defaults to true. The hook is also inert above 1024px whatever this says. */
  enabled?: boolean;
}

function matches(query: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches
  );
}

/**
 * Pointer drag-to-dismiss for a bottom sheet. Only active on phone and tablet
 * (`(max-width: 1024px)`). A downward drag that starts while the sheet is
 * scrolled to the top (or on its header) follows the pointer; releasing past
 * 96px or faster than 0.6 px/ms calls `onDismiss`, otherwise the sheet snaps
 * back (class `is-snapping` for a --dur-component transition; no transition
 * under prefers-reduced-motion).
 */
export function useSheetDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  { enabled = true }: Options = {},
) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || !matches(SHEET_QUERY)) return;

    let pointerId: number | null = null;
    let startY = 0;
    let startTime = 0;
    let lastY = 0;
    let distance = 0;
    let snapTimer: ReturnType<typeof setTimeout> | undefined;

    const endSnap = () => {
      el.classList.remove('is-snapping');
      el.removeEventListener('transitionend', endSnap);
      if (snapTimer !== undefined) clearTimeout(snapTimer);
      snapTimer = undefined;
    };

    const canStart = (target: EventTarget | null) =>
      el.scrollTop <= 0 || (target instanceof Element && target.closest('header') !== null);

    const onDown = (e: PointerEvent) => {
      if (pointerId !== null || !e.isPrimary || e.button !== 0) return;
      if (!canStart(e.target)) return;
      endSnap();
      pointerId = e.pointerId;
      startY = lastY = e.clientY;
      startTime = e.timeStamp;
      distance = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      distance = Math.max(0, e.clientY - startY);
      lastY = e.clientY;
      el.style.transition = 'none';
      el.style.transform = distance > 0 ? `translateY(${distance}px)` : '';
      if (distance > 0 && e.cancelable) e.preventDefault();
    };

    const release = (e: PointerEvent, cancelled: boolean) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      const dt = Math.max(1, e.timeStamp - startTime);
      const velocity = (lastY - startY) / dt;
      el.style.transition = '';
      if (!cancelled && (distance > SHEET_DISMISS_DISTANCE || velocity > SHEET_DISMISS_VELOCITY)) {
        onDismiss();
        return;
      }
      if (distance > 0 && !matches('(prefers-reduced-motion: reduce)')) {
        el.classList.add('is-snapping');
        el.addEventListener('transitionend', endSnap);
        snapTimer = setTimeout(endSnap, 400);
      }
      el.style.transform = '';
    };
    const onUp = (e: PointerEvent) => release(e, false);
    const onCancel = (e: PointerEvent) => release(e, true);

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      endSnap();
      el.style.transform = '';
      el.style.transition = '';
    };
  }, [ref, onDismiss, enabled]);
}
