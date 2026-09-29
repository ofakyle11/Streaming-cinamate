import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BeforeInstallPromptEvent,
  createInstallPromptController,
  InstallPromptController,
  isIosSafariLike,
} from './install';

type Outcome = 'accepted' | 'dismissed';

function makePromptEvent(outcome: Outcome, opts: { rejectPrompt?: boolean } = {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  const prompt = vi.fn(() => (opts.rejectPrompt ? Promise.reject(new Error('no gesture')) : Promise.resolve()));
  Object.assign(event, {
    platforms: ['web'],
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
    prompt,
  });
  return { event, prompt };
}

interface FakeWindowOptions {
  standalone?: boolean;
  ua?: string;
  platform?: string;
  maxTouchPoints?: number;
}

function makeWindow(opts: FakeWindowOptions = {}) {
  const target = new EventTarget();
  const mqlListeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: !!opts.standalone,
    media: '(display-mode: standalone)',
    addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => mqlListeners.add(l),
    removeEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => mqlListeners.delete(l),
  };
  const win = Object.assign(target, {
    navigator: {
      userAgent: opts.ua ?? 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0',
      platform: opts.platform ?? 'Linux x86_64',
      maxTouchPoints: opts.maxTouchPoints ?? 0,
    },
    matchMedia: () => mql,
  });
  const fireDisplayMode = (matches: boolean) =>
    mqlListeners.forEach((l) => l({ matches } as MediaQueryListEvent));
  return { win: win as unknown as Window, fireDisplayMode, mqlListeners };
}

let controller: InstallPromptController | null = null;
afterEach(() => {
  controller?.destroy();
  controller = null;
});

describe('install prompt controller', () => {
  it('starts unavailable in a regular browser tab', () => {
    const { win } = makeWindow();
    controller = createInstallPromptController(win);
    expect(controller.getStatus()).toBe('unavailable');
  });

  it('reports installed when already running standalone', () => {
    const { win } = makeWindow({ standalone: true });
    controller = createInstallPromptController(win);
    expect(controller.getStatus()).toBe('installed');
  });

  it('offers manual instructions on iOS', () => {
    const { win } = makeWindow({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1' });
    controller = createInstallPromptController(win);
    expect(controller.getStatus()).toBe('manual-ios');
  });

  it('captures beforeinstallprompt, suppresses the infobar and notifies subscribers', () => {
    const { win } = makeWindow();
    controller = createInstallPromptController(win);
    const listener = vi.fn();
    controller.subscribe(listener);
    const { event } = makePromptEvent('accepted');
    win.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(controller.getStatus()).toBe('available');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('prompts and becomes installed when the user accepts', async () => {
    const { win } = makeWindow();
    controller = createInstallPromptController(win);
    const { event, prompt } = makePromptEvent('accepted');
    win.dispatchEvent(event);
    const pending = controller.promptInstall();
    expect(controller.getStatus()).toBe('prompting');
    await expect(pending).resolves.toBe('accepted');
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(controller.getStatus()).toBe('installed');
  });

  it('only uses a captured event once; dismissal makes it unavailable', async () => {
    const { win } = makeWindow();
    controller = createInstallPromptController(win);
    const { event, prompt } = makePromptEvent('dismissed');
    win.dispatchEvent(event);
    await expect(controller.promptInstall()).resolves.toBe('dismissed');
    expect(controller.getStatus()).toBe('unavailable');
    await expect(controller.promptInstall()).resolves.toBe('unavailable');
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('becomes available again if the browser re-offers after a dismissal', async () => {
    const { win } = makeWindow();
    controller = createInstallPromptController(win);
    win.dispatchEvent(makePromptEvent('dismissed').event);
    await controller.promptInstall();
    win.dispatchEvent(makePromptEvent('accepted').event);
    expect(controller.getStatus()).toBe('available');
  });

  it('recovers when prompt() rejects', async () => {
    const { win } = makeWindow();
    controller = createInstallPromptController(win);
    win.dispatchEvent(makePromptEvent('accepted', { rejectPrompt: true }).event);
    await expect(controller.promptInstall()).resolves.toBe('unavailable');
    expect(controller.getStatus()).toBe('unavailable');
  });

  it('returns unavailable when nothing was captured', async () => {
    const { win } = makeWindow();
    controller = createInstallPromptController(win);
    await expect(controller.promptInstall()).resolves.toBe('unavailable');
  });

  it('marks installed on appinstalled and on display-mode change', () => {
    const a = makeWindow();
    controller = createInstallPromptController(a.win);
    a.win.dispatchEvent(new Event('appinstalled'));
    expect(controller.getStatus()).toBe('installed');
    controller.destroy();

    const b = makeWindow();
    controller = createInstallPromptController(b.win);
    b.fireDisplayMode(true);
    expect(controller.getStatus()).toBe('installed');
  });

  it('ignores prompts once installed and removes listeners on destroy', () => {
    const { win, mqlListeners } = makeWindow({ standalone: true });
    controller = createInstallPromptController(win);
    win.dispatchEvent(makePromptEvent('accepted').event);
    expect(controller.getStatus()).toBe('installed');
    controller.destroy();
    expect(mqlListeners.size).toBe(0);
  });
});

describe('isIosSafariLike', () => {
  it('detects iPhone and iPadOS desktop-mode Safari', () => {
    expect(isIosSafariLike({ userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5 })).toBe(true);
    expect(isIosSafariLike({ userAgent: 'Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
  });

  it('does not flag desktop Macs or Android', () => {
    expect(isIosSafariLike({ userAgent: 'Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIosSafariLike({ userAgent: 'Android Chrome', platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false);
  });
});
