import { useCallback, useLayoutEffect, useRef, type FocusEvent as ReactFocusEvent, type RefObject } from 'react';

interface Options {
  /** Where focus goes when the list is now empty (e.g. the row heading). */
  fallback: () => HTMLElement | null;
  /** Selector for the focus target inside each item. Default `.card-link`. */
  itemSelector?: string;
  /** Reduced motion: scroll the new target into view instantly instead of smoothly. */
  reduceMotion?: boolean;
}

/** The container's direct child holding `node`, or null. */
function itemIndexOf(container: HTMLElement, node: Node | null): number {
  let el: Node | null = node;
  while (el && el.parentNode !== container) el = el.parentNode;
  return el ? Array.prototype.indexOf.call(container.children, el) : -1;
}

function focusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body || !active.isConnected;
}

/** Moves focus to `el` without letting the browser jump-scroll, then scrolls it into view honouring reduced motion. */
export function focusWithoutJump(el: HTMLElement, reduceMotion: boolean) {
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}

/**
 * Keeps keyboard focus in a list of cards when the focused card unmounts
 * (removed, rated away, un-saved). `keys` must match the container's direct
 * children one-to-one, in order. When the card that last held focus disappears
 * and focus fell to <body>, the card now at the same index (or the last one) is
 * focused; an empty list focuses `fallback()`. Spread the returned handlers
 * onto the container.
 */
export function useKeepFocusOnRemoval(
  containerRef: RefObject<HTMLElement | null>,
  keys: readonly string[],
  { fallback, itemSelector = '.card-link', reduceMotion = false }: Options,
) {
  const last = useRef<{ key: string; index: number } | null>(null);
  const keysRef = useRef(keys);
  const optsRef = useRef({ fallback, itemSelector, reduceMotion });
  // Latest values for event handlers; runs before the removal check below.
  useLayoutEffect(() => {
    keysRef.current = keys;
    optsRef.current = { fallback, itemSelector, reduceMotion };
  });

  const onFocus = useCallback(
    (e: ReactFocusEvent<HTMLElement>) => {
      const index = itemIndexOf(e.currentTarget, e.target);
      const key = index >= 0 ? keysRef.current[index] : undefined;
      last.current = key === undefined ? null : { key, index };
    },
    [],
  );

  const onBlur = useCallback((e: ReactFocusEvent<HTMLElement>) => {
    // Focus moved elsewhere on purpose; a removal leaves relatedTarget null.
    const next = e.relatedTarget as Node | null;
    if (next && !e.currentTarget.contains(next)) last.current = null;
  }, []);

  const keysKey = keys.join('\n');
  useLayoutEffect(() => {
    const prev = last.current;
    if (!prev || keys.includes(prev.key) || !focusLost()) return;
    last.current = null;
    const { fallback: fb, itemSelector: sel, reduceMotion: rm } = optsRef.current;
    const el = containerRef.current;
    const index = Math.min(prev.index, keys.length - 1);
    const item = el && index >= 0 ? el.children[index] : null;
    const target = (item?.querySelector<HTMLElement>(sel) ?? null) || fb();
    if (target) focusWithoutJump(target, rm);
    // `keysKey` captures the key list; `keys` itself is a fresh array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysKey]);

  /** Spread onto the list container (`onFocus`/`onBlur` bubble like focusin/focusout). */
  return { onFocus, onBlur };
}
