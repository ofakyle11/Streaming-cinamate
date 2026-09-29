/**
 * Install-prompt controller for the PWA.
 *
 * Chromium browsers fire `beforeinstallprompt` once, early, and only let the
 * page call `prompt()` on that captured event after a user gesture. We capture
 * it at startup (initInstallPrompt in main.tsx) so the Account page can offer
 * an "Install app" button whenever the user gets there.
 *
 * iOS Safari has no install API; we detect it and surface manual instructions.
 */
import { useSyncExternalStore } from 'react';

/** Non-standard Chromium event (not in lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallStatus =
  /** Browser has not offered installation (unsupported, criteria unmet, or dismissed). */
  | 'unavailable'
  /** A deferred prompt is ready; show the install button. */
  | 'available'
  /** The native prompt is open. */
  | 'prompting'
  /** Running as an installed app, or the user just installed it. */
  | 'installed'
  /** iOS/iPadOS Safari: install manually via Share -> Add to Home Screen. */
  | 'manual-ios';

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface InstallPromptController {
  getStatus(): InstallStatus;
  subscribe(listener: () => void): () => void;
  /** Opens the native install prompt. Must be called from a user gesture. */
  promptInstall(): Promise<InstallOutcome>;
  /** Removes window listeners. */
  destroy(): void;
}

const STANDALONE_QUERY = '(display-mode: standalone)';

type InstallWindow = Window & { navigator: Navigator & { standalone?: boolean } };

export function isStandalone(win: InstallWindow): boolean {
  if (win.navigator.standalone === true) return true;
  try {
    return typeof win.matchMedia === 'function' && win.matchMedia(STANDALONE_QUERY).matches;
  } catch {
    return false;
  }
}

export function isIosSafariLike(nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  const ua = nav.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS 13+ reports itself as desktop Safari on a touch-capable Mac.
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

function initialStatus(win: InstallWindow): InstallStatus {
  if (isStandalone(win)) return 'installed';
  if (isIosSafariLike(win.navigator)) return 'manual-ios';
  return 'unavailable';
}

export function createInstallPromptController(win: InstallWindow): InstallPromptController {
  let status: InstallStatus = initialStatus(win);
  let deferred: BeforeInstallPromptEvent | null = null;
  const listeners = new Set<() => void>();

  const setStatus = (next: InstallStatus) => {
    if (next === status) return;
    status = next;
    listeners.forEach((l) => l());
  };

  const onBeforeInstallPrompt = (event: Event) => {
    // Suppress the mini-infobar; we show our own button instead.
    event.preventDefault();
    if (status === 'installed') return;
    deferred = event as BeforeInstallPromptEvent;
    if (status !== 'prompting') setStatus('available');
  };

  const onInstalled = () => {
    deferred = null;
    setStatus('installed');
  };

  let mql: MediaQueryList | null = null;
  const onDisplayModeChange = (e: MediaQueryListEvent) => {
    if (e.matches) onInstalled();
  };

  win.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  win.addEventListener('appinstalled', onInstalled);
  try {
    if (typeof win.matchMedia === 'function') {
      mql = win.matchMedia(STANDALONE_QUERY);
      mql.addEventListener?.('change', onDisplayModeChange);
    }
  } catch {
    mql = null;
  }

  return {
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async promptInstall() {
      const event = deferred;
      if (!event || status === 'prompting') return 'unavailable';
      // A captured event can only be prompted once.
      deferred = null;
      setStatus('prompting');
      try {
        await event.prompt();
        const choice = await event.userChoice;
        if (choice.outcome === 'accepted') {
          setStatus('installed');
          return 'accepted';
        }
        // The browser may fire beforeinstallprompt again later.
        setStatus(deferred ? 'available' : 'unavailable');
        return 'dismissed';
      } catch {
        setStatus(deferred ? 'available' : 'unavailable');
        return 'unavailable';
      }
    },
    destroy() {
      win.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      win.removeEventListener('appinstalled', onInstalled);
      mql?.removeEventListener?.('change', onDisplayModeChange);
      listeners.clear();
    },
  };
}

let shared: InstallPromptController | null = null;

/** Starts listening for the install prompt. Idempotent; safe without a window. */
export function initInstallPrompt(): InstallPromptController | null {
  if (typeof window === 'undefined') return null;
  shared ??= createInstallPromptController(window);
  return shared;
}

/** Test helper: drops the shared controller. */
export function resetInstallPrompt(): void {
  shared?.destroy();
  shared = null;
}

const noopSubscribe = () => () => {};
const unavailable = (): InstallStatus => 'unavailable';

export function useInstallPrompt(): {
  status: InstallStatus;
  promptInstall: () => Promise<InstallOutcome>;
} {
  const controller = initInstallPrompt();
  const status = useSyncExternalStore(
    controller ? controller.subscribe : noopSubscribe,
    controller ? controller.getStatus : unavailable,
    unavailable,
  );
  return {
    status,
    promptInstall: controller ? controller.promptInstall : async () => 'unavailable',
  };
}
