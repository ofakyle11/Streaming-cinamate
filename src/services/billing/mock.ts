import type { BillingService, Plan, PlanId, Subscription } from '../types';
import type { BillingAdapter, CheckoutResult } from './types';
import { isPlanId } from './types';

/**
 * Mock billing. There is intentionally NO live billing adapter in the client:
 * checkout will be handled by our own backend later. This mock never touches a
 * payment provider and never needs a key. It stores a fake subscription per
 * user in localStorage (falling back to memory when storage is unavailable).
 */
export const MOCK_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    currency: 'USD',
    features: ['Browse & discover', 'Watchlist', 'Ads'],
  },
  {
    id: 'plus',
    name: 'Plus',
    priceCents: 799,
    currency: 'USD',
    features: ['Everything in Free', 'No ads', 'HD'],
  },
  {
    id: 'premium',
    name: 'Premium',
    priceCents: 1499,
    currency: 'USD',
    features: ['Everything in Plus', '4K + HDR', '4 screens'],
  },
];

export const MOCK_BILLING_STORAGE_KEY = 'lf.mock.billing';

const STATUSES: ReadonlySet<Subscription['status']> = new Set([
  'active',
  'trialing',
  'past_due',
  'canceled',
]);

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface MockBillingOptions {
  /** Storage backend; defaults to localStorage when available. Pass null for memory only. */
  storage?: StorageLike | null;
  /** Clock, injectable for tests. */
  now?: () => Date;
}

/** Implements both contracts; its startCheckout also returns the new subscription. */
export type MockBilling = Omit<BillingService, 'startCheckout'> & BillingAdapter;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isSubscription(value: unknown, userId: string): value is Subscription {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    s.userId === userId &&
    isPlanId(s.planId) &&
    typeof s.status === 'string' &&
    STATUSES.has(s.status as Subscription['status']) &&
    (s.renewsAt === null || typeof s.renewsAt === 'string')
  );
}

function load(storage: StorageLike | null): Map<string, Subscription> {
  const subs = new Map<string, Subscription>();
  if (!storage) return subs;
  try {
    const raw = storage.getItem(MOCK_BILLING_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [userId, sub] of Object.entries(parsed as Record<string, unknown>)) {
        if (isSubscription(sub, userId)) subs.set(userId, { ...sub });
      }
    }
  } catch {
    /* corrupt or unavailable storage: start fresh */
  }
  return subs;
}

function persist(storage: StorageLike | null, subs: Map<string, Subscription>) {
  if (!storage) return;
  try {
    storage.setItem(MOCK_BILLING_STORAGE_KEY, JSON.stringify(Object.fromEntries(subs)));
  } catch {
    /* quota / private mode: keep in memory only */
  }
}

export function createMockBilling(options: MockBillingOptions = {}): MockBilling {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const now = options.now ?? (() => new Date());
  const subs = load(storage);

  const freeSub = (userId: string): Subscription => ({
    userId,
    planId: 'free',
    status: 'active',
    renewsAt: null,
  });
  const monthFromNow = () => {
    const d = new Date(now().getTime());
    d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  };
  const current = (userId: string): Subscription => ({ ...(subs.get(userId) ?? freeSub(userId)) });

  const checkout = async (userId: string, planId: PlanId): Promise<CheckoutResult> => {
    if (!userId) throw new Error('A user id is required to start checkout.');
    if (!MOCK_PLANS.some((p) => p.id === planId))
      throw new Error(`Unknown plan: ${String(planId)}`);
    // Mock checkout "succeeds" instantly and returns an in-app URL.
    const paid = planId !== 'free';
    const subscription: Subscription = {
      userId,
      planId,
      status: paid ? 'trialing' : 'active',
      renewsAt: paid ? monthFromNow() : null,
    };
    subs.set(userId, subscription);
    persist(storage, subs);
    return {
      url: `/account?checkout=success&plan=${encodeURIComponent(planId)}`,
      subscription: { ...subscription },
    };
  };

  const plans = async () => MOCK_PLANS.map((p) => ({ ...p, features: [...p.features] }));
  const subscription = async (userId: string) => current(userId);

  return {
    plans,
    getPlans: plans,
    subscription,
    getSubscription: subscription,
    startCheckout: checkout,
    async cancel(userId) {
      const updated: Subscription = { ...current(userId), status: 'canceled' };
      subs.set(userId, updated);
      persist(storage, subs);
      return { ...updated };
    },
  };
}

/** Convenience: a standalone mock BillingAdapter. */
export function createMockBillingAdapter(options?: MockBillingOptions): BillingAdapter {
  return createMockBilling(options);
}
