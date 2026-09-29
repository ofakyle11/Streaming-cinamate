import type { BillingService, Plan, Subscription } from '../types';

/**
 * Mock billing. There is intentionally NO live billing adapter in the client:
 * checkout will be handled by our own backend later. This mock never touches a
 * payment provider and never needs a key.
 */
export const MOCK_PLANS: Plan[] = [
  { id: 'free', name: 'Free', priceCents: 0, currency: 'USD', features: ['Browse & discover', 'Watchlist', 'Ads'] },
  { id: 'plus', name: 'Plus', priceCents: 799, currency: 'USD', features: ['Everything in Free', 'No ads', 'HD'] },
  { id: 'premium', name: 'Premium', priceCents: 1499, currency: 'USD', features: ['Everything in Plus', '4K + HDR', '4 screens'] },
];

const STORAGE_KEY = 'lf.mock.billing';

function load(): Record<string, Subscription> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Subscription>) : {};
  } catch {
    return {};
  }
}

function persist(subs: Record<string, Subscription>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
  } catch {
    /* ignore */
  }
}

const monthFromNow = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
};

export function createMockBilling(): BillingService {
  const subs = load();
  const freeSub = (userId: string): Subscription => ({ userId, planId: 'free', status: 'active', renewsAt: null });

  return {
    async plans() {
      return MOCK_PLANS;
    },
    async subscription(userId) {
      return subs[userId] ?? freeSub(userId);
    },
    async startCheckout(userId, planId) {
      if (!MOCK_PLANS.some((p) => p.id === planId)) throw new Error(`Unknown plan: ${planId}`);
      // Mock checkout "succeeds" instantly and returns an in-app URL.
      subs[userId] = { userId, planId, status: planId === 'free' ? 'active' : 'trialing', renewsAt: planId === 'free' ? null : monthFromNow() };
      persist(subs);
      return { url: `/account?checkout=success&plan=${planId}` };
    },
    async cancel(userId) {
      const current = subs[userId] ?? freeSub(userId);
      subs[userId] = { ...current, status: 'canceled' };
      persist(subs);
      return subs[userId];
    },
  };
}
