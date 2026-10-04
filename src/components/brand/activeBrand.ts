import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { ACTIVE_BRAND, isColourwayId, isMarkId, type ColourwayId, type MarkId } from './marks';

/** A mark + colourway pair. */
export interface BrandChoice {
  mark: MarkId;
  colourway: ColourwayId;
}

/** localStorage key for a per-browser preview override set from /brand. */
export const BRAND_PREVIEW_KEY = 'lf.brand';
const CHANGE_EVENT = 'lf:brand-preview';

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(BRAND_PREVIEW_KEY);
  } catch {
    return null;
  }
}

/** Parses a stored preview; anything malformed or unknown counts as "no preview". */
export function parseBrandPreview(raw: string | null): BrandChoice | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const { mark, colourway } = value as Record<string, unknown>;
    if (typeof mark !== 'string' || !isMarkId(mark)) return null;
    if (typeof colourway !== 'string' || !isColourwayId(colourway)) return null;
    return { mark, colourway };
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Previews a direction across the app in this browser only (the kit's "Try it in the app"). */
export function setBrandPreview(choice: BrandChoice): void {
  try {
    window.localStorage.setItem(BRAND_PREVIEW_KEY, JSON.stringify(choice));
  } catch {
    /* storage unavailable: the preview simply does not persist */
  }
  notify();
}

/** Returns the app to the committed ACTIVE_BRAND. */
export function clearBrandPreview(): void {
  try {
    window.localStorage.removeItem(BRAND_PREVIEW_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

export interface ActiveBrand extends BrandChoice {
  /** True while a preview from /brand overrides the committed brand. */
  isPreview: boolean;
  setPreview: (choice: BrandChoice) => void;
  clearPreview: () => void;
}

/**
 * The brand the app should draw right now: the committed ACTIVE_BRAND unless
 * the kit page has set a preview in this browser. Shared across tabs.
 */
export function useActiveBrand(): ActiveBrand {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const preview = useMemo(() => parseBrandPreview(raw), [raw]);
  const setPreview = useCallback((choice: BrandChoice) => setBrandPreview(choice), []);
  const clearPreview = useCallback(() => clearBrandPreview(), []);
  return {
    mark: preview?.mark ?? ACTIVE_BRAND.mark,
    colourway: preview?.colourway ?? ACTIVE_BRAND.colourway,
    isPreview: preview !== null,
    setPreview,
    clearPreview,
  };
}
