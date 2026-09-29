import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnlineStatus } from './useOnlineStatus';

describe('useOnlineStatus', () => {
  let online = true;

  beforeEach(() => {
    online = true;
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const dispatch = (value: boolean) => {
    online = value;
    act(() => {
      window.dispatchEvent(new Event(value ? 'online' : 'offline'));
    });
  };

  it('reads navigator.onLine initially (online)', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('reads navigator.onLine initially (offline)', () => {
    online = false;
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('updates on offline and online events', () => {
    const { result } = renderHook(() => useOnlineStatus());
    dispatch(false);
    expect(result.current).toBe(false);
    dispatch(true);
    expect(result.current).toBe(true);
  });

  it('removes its listeners on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();
    const events = remove.mock.calls.map(([type]) => type);
    expect(events).toEqual(expect.arrayContaining(['online', 'offline']));
  });
});
