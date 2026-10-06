import { beforeEach, describe, expect, it } from 'vitest';
import { currentDeviceId, describeUserAgent, DEVICE_ID_KEY } from './devices';

describe('device identity', () => {
  beforeEach(() => localStorage.clear());

  it('mints one id per browser and keeps it across calls', () => {
    const id = currentDeviceId();
    expect(id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(currentDeviceId()).toBe(id);
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(id);
  });

  it('replaces a corrupt stored id', () => {
    localStorage.setItem(DEVICE_ID_KEY, 'x');
    expect(currentDeviceId()).not.toBe('x');
  });

  it('works without storage (private mode) with a stable in-memory id', () => {
    const a = currentDeviceId(null);
    expect(currentDeviceId(null)).toBe(a);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(currentDeviceId(throwing)).toBe(a);
  });

  it.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      'Chrome on macOS',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0',
      'Edge on Windows',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Safari on iPhone',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0', 'Firefox on Linux'],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
      'Chrome on Android',
    ],
    ['', 'Browser'],
  ])('describes %s', (ua, label) => {
    expect(describeUserAgent(ua)).toBe(label);
  });
});
