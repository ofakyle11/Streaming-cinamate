/**
 * Billing adapter contract used by the Plans page.
 *
 * The client never talks to a payment provider directly: no provider SDK is
 * imported and no provider keys live in client code. A future live adapter
 * would call our own backend, which owns any secrets. Today only the mock
 * adapter exists (see ./mock.ts).
 */
import type { BillingService, Plan, PlanId, Subscription } from '../types';

export type { Plan, PlanId, Subscription };

export interface CheckoutResult {
  /**
   * Where to send the user next. The mock returns an in-app path; a live
   * adapter would return a hosted checkout page served by our backend.
   */
  url: string;
  /** The subscription as it stands after checkout was started. */
  subscription: Subscription;
}

export interface BillingAdapter {
  /** All purchasable plans, cheapest first. */
  getPlans(): Promise<Plan[]>;
  /** The user's current subscription (a free, active one when none exists). */
  getSubscription(userId: string): Promise<Subscription>;
  /** Begin checkout for `planId`. Rejects for unknown plans. */
  startCheckout(userId: string, planId: PlanId): Promise<CheckoutResult>;
}

/** Stable display order for plans. */
export const PLAN_ORDER: readonly PlanId[] = ['free', 'plus', 'premium'];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_ORDER as readonly string[]).includes(value);
}

/** Sort plans into PLAN_ORDER (unknown ids go last, keeping their relative order). */
export function sortPlans(plans: readonly Plan[]): Plan[] {
  const rank = (id: PlanId) => {
    const i = PLAN_ORDER.indexOf(id);
    return i === -1 ? PLAN_ORDER.length : i;
  };
  return [...plans].sort((a, b) => rank(a.id) - rank(b.id));
}

/** Compare two plan tiers: negative when `a` is lower than `b`. */
export function comparePlanTier(a: PlanId, b: PlanId): number {
  return PLAN_ORDER.indexOf(a) - PLAN_ORDER.indexOf(b);
}

/** Format a monthly price in minor units, e.g. 799 USD -> "$7.99". Free plans read "Free". */
export function formatPrice(priceCents: number, currency: string, locale = 'en-US'): string {
  if (!Number.isFinite(priceCents) || priceCents <= 0) return 'Free';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(priceCents / 100);
  } catch {
    return `${(priceCents / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * A checkout URL is only followed when it is an in-app path or an https URL.
 * Anything else (javascript:, data:, protocol-relative, http) is rejected.
 */
export function isSafeCheckoutUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (url.startsWith('/')) return !url.startsWith('//') && !url.startsWith('/\\');
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Wrap the app-wide BillingService in the BillingAdapter contract. */
export function fromBillingService(service: BillingService): BillingAdapter {
  return {
    getPlans: async () => sortPlans(await service.plans()),
    getSubscription: (userId) => service.subscription(userId),
    async startCheckout(userId, planId) {
      if (!isPlanId(planId)) throw new Error(`Unknown plan: ${String(planId)}`);
      const { url } = await service.startCheckout(userId, planId);
      const subscription = await service.subscription(userId);
      return { url, subscription };
    },
  };
}

/* ---------------------------------------------------------- feature table */

export type FeatureValue = boolean | string;

export interface PlanFeatureRow {
  label: string;
  values: Record<PlanId, FeatureValue>;
}

/** Comparison table shown under the plan cards. */
export const PLAN_FEATURES: readonly PlanFeatureRow[] = [
  { label: 'Browse & discover', values: { free: true, plus: true, premium: true } },
  { label: 'Watchlist & history sync', values: { free: true, plus: true, premium: true } },
  { label: 'Ad-free', values: { free: false, plus: true, premium: true } },
  { label: 'Video quality', values: { free: 'SD', plus: 'HD', premium: '4K + HDR' } },
  { label: 'Profiles', values: { free: '1', plus: '3', premium: '5' } },
  { label: 'Screens at once', values: { free: '1', plus: '2', premium: '4' } },
  { label: 'Offline downloads', values: { free: false, plus: false, premium: true } },
];
