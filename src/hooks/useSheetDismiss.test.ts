import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSheetDismiss } from './useSheetDismiss';

function mockMatchMedia(matching: (query: string) => boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: matching(query),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

/** jsdom has no PointerEvent constructor; a MouseEvent with the pointer fields is enough for the hook. */
function pointer(
  el: Element,
  type: string,
  clientY: number,
  timeStamp: number,
  over: Record<string, unknown> = {},
) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientY, button: 0 });
  Object.defineProperties(e, {
    pointerId: { value: 1 },
    isPrimary: { value: true },
    timeStamp: { value: timeStamp },
    ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, { value: v }])),
  });
  el.dispatchEvent(e);
}

function drag(el: Element, to: number, ms = 1000) {
  pointer(el, 'pointerdown', 100, 0);
  pointer(el, 'pointermove', 100 + to / 2, ms / 2);
  pointer(el, 'pointermove', 100 + to, ms);
  pointer(el, 'pointerup', 100 + to, ms);
}

describe('useSheetDismiss', () => {
  let sheet: HTMLDivElement;
  const onDismiss = vi.fn();

  beforeEach(() => {
    onDismiss.mockReset();
    sheet = document.createElement('div');
    sheet.innerHTML = '<header><h2>Sheet</h2></header><div class="body">body</div>';
    document.body.appendChild(sheet);
    mockMatchMedia((q) => q.includes('max-width: 1024px'));
  });

  afterEach(() => {
    sheet.remove();
    vi.restoreAllMocks();
  });

  function mount() {
    return renderHook(() => useSheetDismiss({ current: sheet }, onDismiss));
  }

  it('follows a downward drag and dismisses past 96px', () => {
    mount();
    pointer(sheet, 'pointerdown', 100, 0);
    pointer(sheet, 'pointermove', 140, 500);
    expect(sheet.style.transform).toBe('translateY(40px)');
    expect(sheet.style.transition).toBe('none');
    pointer(sheet, 'pointermove', 220, 1000);
    expect(sheet.style.transform).toBe('translateY(120px)');
    pointer(sheet, 'pointerup', 220, 1000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('snaps back below the threshold (with the snapping class) and does not dismiss', () => {
    mount();
    drag(sheet, 60, 1000);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe('');
    expect(sheet.style.transition).toBe('');
    expect(sheet.classList.contains('is-snapping')).toBe(true);
    sheet.dispatchEvent(new Event('transitionend'));
    expect(sheet.classList.contains('is-snapping')).toBe(false);
  });

  it('dismisses a short but fast flick (velocity > 0.6 px/ms)', () => {
    mount();
    drag(sheet, 40, 40);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ignores upward drags', () => {
    mount();
    pointer(sheet, 'pointerdown', 300, 0);
    pointer(sheet, 'pointermove', 100, 100);
    expect(sheet.style.transform).toBe('');
    pointer(sheet, 'pointerup', 100, 100);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('only starts from the top of the sheet or its header', () => {
    mount();
    Object.defineProperty(sheet, 'scrollTop', { value: 120, configurable: true });
    const body = sheet.querySelector('.body')!;
    drag(body, 200);
    expect(onDismiss).not.toHaveBeenCalled();
    const header = sheet.querySelector('header')!;
    drag(header, 200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('is inert on desktop (> 1024px)', () => {
    mockMatchMedia(() => false);
    mount();
    drag(sheet, 400, 100);
    expect(sheet.style.transform).toBe('');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('is inert when disabled', () => {
    renderHook(() => useSheetDismiss({ current: sheet }, onDismiss, { enabled: false }));
    drag(sheet, 400, 100);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('snaps back without the transition class under reduced motion, but still dismisses past the threshold', () => {
    mockMatchMedia((q) => q.includes('max-width: 1024px') || q.includes('prefers-reduced-motion'));
    mount();
    drag(sheet, 60, 1000);
    expect(sheet.classList.contains('is-snapping')).toBe(false);
    expect(sheet.style.transform).toBe('');
    expect(onDismiss).not.toHaveBeenCalled();
    drag(sheet, 200, 1000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('cleans up listeners and inline styles on unmount', () => {
    const { unmount } = mount();
    pointer(sheet, 'pointerdown', 100, 0);
    pointer(sheet, 'pointermove', 150, 100);
    expect(sheet.style.transform).toBe('translateY(50px)');
    unmount();
    expect(sheet.style.transform).toBe('');
    drag(sheet, 400, 100);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
