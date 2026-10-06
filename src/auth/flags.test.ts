import { describe, expect, it } from 'vitest';
import { flagOn, googleSignInEnabled } from './flags';

describe('sign-in flags', () => {
  it('is off by default and with anything but an on value', () => {
    expect(googleSignInEnabled({})).toBe(false);
    expect(googleSignInEnabled({ VITE_AUTH_GOOGLE: '' })).toBe(false);
    expect(googleSignInEnabled({ VITE_AUTH_GOOGLE: '0' })).toBe(false);
    expect(googleSignInEnabled({ VITE_AUTH_GOOGLE: 'false' })).toBe(false);
    expect(googleSignInEnabled({ VITE_AUTH_GOOGLE: true })).toBe(false);
  });

  it('turns on with 1 / true / on', () => {
    for (const v of ['1', 'true', 'ON', ' yes ']) expect(flagOn(v)).toBe(true);
    expect(googleSignInEnabled({ VITE_AUTH_GOOGLE: '1' })).toBe(true);
  });
});
