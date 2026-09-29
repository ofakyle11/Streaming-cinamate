import { describe, expect, it, vi } from 'vitest';
import {
  MOCK_BILLING_STORAGE_KEY,
  MOCK_PLANS,
  createMockBilling,
  createMockBillingAdapter,
} from './mock';
import {
  PLAN_FEATURES,
  PLAN_ORDER,
  comparePlanTier,
  formatPrice,
  fromBillingService,
  isPlanId,
  isSafeCheckoutUrl,
  sortPlans,
} from './types';
import type { PlanId } from './types';
import type { BillingService } from '../types';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void data.set(k, v)),
    data,
  };
}

const fixedNow = () => new Date('2026-01-15T12:00:00.000Z');

describe('billing helpers', () => {
  it('recognises plan ids', () => {
    expect(isPlanId('free')).toBe(true);
    expect(isPlanId('premium')).toBe(true);
    expect(isPlanId('gold')).toBe(false);
    expect(isPlanId(undefined)).toBe(false);
  });

  it('sorts plans into tier order without mutating input', () => {
    const shuffled = [MOCK_PLANS[2], MOCK_PLANS[0], MOCK_PLANS[1]];
    expect(sortPlans(shuffled).map((p) => p.id)).toEqual(PLAN_ORDER);
    expect(shuffled[0].id).toBe('premium');
  });

  it('compares tiers', () => {
    expect(comparePlanTier('free', 'plus')).toBeLessThan(0);
    expect(comparePlanTier('premium', 'plus')).toBeGreaterThan(0);
    expect(comparePlanTier('plus', 'plus')).toBe(0);
  });

  it('formats prices', () => {
    expect(formatPrice(0, 'USD')).toBe('Free');
    expect(formatPrice(799, 'USD')).toBe('$7.99');
    expect(formatPrice(1499, 'USD')).toBe('$14.99');
    expect(formatPrice(500, 'NOT-A-CURRENCY')).toBe('5.00 NOT-A-CURRENCY');
    expect(formatPrice(Number.NaN, 'USD')).toBe('Free');
  });

  it('only allows in-app or https checkout URLs', () => {
    expect(isSafeCheckoutUrl('/account?checkout=success')).toBe(true);
    expect(isSafeCheckoutUrl('https://billing.example.com/session/1')).toBe(true);
    expect(isSafeCheckoutUrl('//evil.example.com')).toBe(false);
    expect(isSafeCheckoutUrl('/\\evil.example.com')).toBe(false);
    expect(isSafeCheckoutUrl('http://insecure.example.com')).toBe(false);
    expect(isSafeCheckoutUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeCheckoutUrl('data:text/html,hi')).toBe(false);
    expect(isSafeCheckoutUrl('')).toBe(false);
  });

  it('has a feature table value for every plan', () => {
    for (const row of PLAN_FEATURES) {
      for (const id of PLAN_ORDER) expect(row.values[id]).toBeDefined();
    }
  });
});

describe('mock billing adapter', () => {
  it('lists the three plans in order, as copies', async () => {
    const billing = createMockBilling({ storage: null });
    const plans = await billing.getPlans();
    expect(plans.map((p) => p.id)).toEqual(['free', 'plus', 'premium']);
    plans[0].features.push('mutated');
    expect((await billing.getPlans())[0].features).not.toContain('mutated');
  });

  it('defaults to an active free subscription', async () => {
    const billing = createMockBilling({ storage: null });
    expect(await billing.getSubscription('u1')).toEqual({
      userId: 'u1',
      planId: 'free',
      status: 'active',
      renewsAt: null,
    });
  });

  it('stores a fake trialing subscription on paid checkout', async () => {
    const storage = memoryStorage();
    const billing = createMockBilling({ storage, now: fixedNow });
    const result = await billing.startCheckout('u1', 'plus');
    expect(result.url).toBe('/account?checkout=success&plan=plus');
    expect(result.subscription).toEqual({
      userId: 'u1',
      planId: 'plus',
      status: 'trialing',
      renewsAt: '2026-02-15T12:00:00.000Z',
    });
    expect(await billing.getSubscription('u1')).toEqual(result.subscription);
    expect(await billing.getSubscription('u2')).toMatchObject({ planId: 'free' });
    expect(JSON.parse(storage.data.get(MOCK_BILLING_STORAGE_KEY) ?? '{}')).toHaveProperty(
      'u1.planId',
      'plus',
    );
  });

  it('downgrading to free is active with no renewal', async () => {
    const billing = createMockBilling({ storage: null, now: fixedNow });
    await billing.startCheckout('u1', 'premium');
    const { subscription } = await billing.startCheckout('u1', 'free');
    expect(subscription).toEqual({
      userId: 'u1',
      planId: 'free',
      status: 'active',
      renewsAt: null,
    });
  });

  it('persists across instances sharing storage', async () => {
    const storage = memoryStorage();
    await createMockBilling({ storage, now: fixedNow }).startCheckout('u1', 'premium');
    expect(await createMockBilling({ storage }).getSubscription('u1')).toMatchObject({
      planId: 'premium',
    });
  });

  it('rejects unknown plans and empty users without storing anything', async () => {
    const storage = memoryStorage();
    const billing = createMockBilling({ storage });
    await expect(billing.startCheckout('u1', 'gold' as PlanId)).rejects.toThrow(/Unknown plan/);
    await expect(billing.startCheckout('', 'plus')).rejects.toThrow(/user id/);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('ignores corrupt or tampered storage', async () => {
    const tampered = JSON.stringify({
      good: { userId: 'good', planId: 'plus', status: 'active', renewsAt: null },
      wrongUser: { userId: 'someone-else', planId: 'premium', status: 'active', renewsAt: null },
      badPlan: { userId: 'badPlan', planId: 'gold', status: 'active', renewsAt: null },
      badStatus: { userId: 'badStatus', planId: 'plus', status: 'free-forever', renewsAt: null },
    });
    const billing = createMockBilling({
      storage: memoryStorage({ [MOCK_BILLING_STORAGE_KEY]: tampered }),
    });
    expect(await billing.getSubscription('good')).toMatchObject({ planId: 'plus' });
    expect(await billing.getSubscription('wrongUser')).toMatchObject({ planId: 'free' });
    expect(await billing.getSubscription('badPlan')).toMatchObject({ planId: 'free' });
    expect(await billing.getSubscription('badStatus')).toMatchObject({ planId: 'free' });

    const broken = createMockBilling({
      storage: memoryStorage({ [MOCK_BILLING_STORAGE_KEY]: '{not json' }),
    });
    expect(await broken.getSubscription('x')).toMatchObject({ planId: 'free' });
  });

  it('keeps working when storage throws', async () => {
    const storage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const billing = createMockBillingAdapter({ storage });
    await billing.startCheckout('u1', 'plus');
    expect(await billing.getSubscription('u1')).toMatchObject({ planId: 'plus' });
  });

  it('cancel keeps the plan but marks it canceled', async () => {
    const billing = createMockBilling({ storage: null });
    await billing.startCheckout('u1', 'plus');
    expect(await billing.cancel('u1')).toMatchObject({ planId: 'plus', status: 'canceled' });
  });
});

describe('fromBillingService', () => {
  it('adapts a BillingService and returns the updated subscription', async () => {
    const adapter = fromBillingService(createMockBilling({ storage: null }));
    expect((await adapter.getPlans()).map((p) => p.id)).toEqual(PLAN_ORDER);
    const result = await adapter.startCheckout('u1', 'premium');
    expect(result.subscription.planId).toBe('premium');
  });

  it('sorts plans from the underlying service and validates plan ids', async () => {
    const service: BillingService = {
      plans: async () => [MOCK_PLANS[1], MOCK_PLANS[0]],
      subscription: async (userId) => ({
        userId,
        planId: 'free',
        status: 'active',
        renewsAt: null,
      }),
      startCheckout: vi.fn(async () => ({ url: '/x' })),
      cancel: vi.fn(),
    };
    const adapter = fromBillingService(service);
    expect((await adapter.getPlans()).map((p) => p.id)).toEqual(['free', 'plus']);
    await expect(adapter.startCheckout('u1', 'bogus' as PlanId)).rejects.toThrow(/Unknown plan/);
    expect(service.startCheckout).not.toHaveBeenCalled();
  });
});
