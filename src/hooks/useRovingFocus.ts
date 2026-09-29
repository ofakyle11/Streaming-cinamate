import { KeyboardEvent, useCallback, useRef, useState } from 'react';

export type RovingOrientation = 'horizontal' | 'vertical' | 'both';

export interface RovingFocusOptions {
  orientation?: RovingOrientation;
  /** Wrap from the last item to the first (and back). Default false. */
  loop?: boolean;
  /** Index that owns the tab stop initially. Default 0. */
  initialIndex?: number;
}

export interface RovingItemProps<T extends HTMLElement> {
  ref: (el: T | null) => void;
  tabIndex: 0 | -1;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent<T>) => void;
}

const clamp = (n: number, count: number) => Math.max(0, Math.min(n, count - 1));

/**
 * Roving tabindex for a set of `count` items: exactly one item is in the tab
 * order (tabIndex 0); arrow keys move focus between items, Home/End jump to
 * the ends. Spread `getItemProps(i)` onto each item.
 */
export function useRovingFocus<T extends HTMLElement = HTMLElement>(
  count: number,
  { orientation = 'horizontal', loop = false, initialIndex = 0 }: RovingFocusOptions = {},
) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const items = useRef<Array<T | null>>([]);
  // Items can disappear (filtered lists); keep the tab stop on a real item.
  const current = count > 0 ? clamp(activeIndex, count) : -1;

  const focusIndex = useCallback((i: number) => {
    setActiveIndex(i);
    items.current[i]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<T>, index: number) => {
      if (count === 0 || e.altKey || e.ctrlKey || e.metaKey) return;
      const prevKeys =
        orientation === 'vertical'
          ? ['ArrowUp']
          : orientation === 'horizontal'
            ? ['ArrowLeft']
            : ['ArrowLeft', 'ArrowUp'];
      const nextKeys =
        orientation === 'vertical'
          ? ['ArrowDown']
          : orientation === 'horizontal'
            ? ['ArrowRight']
            : ['ArrowRight', 'ArrowDown'];
      let next: number | null = null;
      if (nextKeys.includes(e.key)) {
        next = index + 1 >= count ? (loop ? 0 : count - 1) : index + 1;
      } else if (prevKeys.includes(e.key)) {
        next = index - 1 < 0 ? (loop ? count - 1 : 0) : index - 1;
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = count - 1;
      }
      if (next === null) return;
      e.preventDefault();
      focusIndex(next);
    },
    [count, loop, orientation, focusIndex],
  );

  const getItemProps = (index: number): RovingItemProps<T> => ({
    ref: (el: T | null) => {
      items.current[index] = el;
    },
    tabIndex: index === current ? 0 : -1,
    onFocus: () => setActiveIndex(index),
    onKeyDown: (e: KeyboardEvent<T>) => onKeyDown(e, index),
  });

  return { activeIndex: current, setActiveIndex, focusIndex, getItemProps };
}
