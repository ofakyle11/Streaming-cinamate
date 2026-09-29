import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { auth as defaultAuth, billingAdapter as defaultBilling, services } from '../services';
import type { AuthService, BillingAdapter, Plan, PlanId, Subscription } from '../services';
import {
  PLAN_FEATURES,
  comparePlanTier,
  formatPrice,
  isSafeCheckoutUrl,
} from '../services/billing/types';
import type { FeatureValue } from '../services/billing/types';
import '../styles/plans.css';

/** Id used for the fake subscription when nobody is signed in (mock mode only). */
export const GUEST_BILLING_ID = 'guest';

const TAGLINES: Record<PlanId, string> = {
  free: 'Discover and track what to watch.',
  plus: 'Ad-free viewing in crisp HD.',
  premium: 'The full cinema: 4K, HDR, every screen.',
};

const RECOMMENDED: PlanId = 'plus';

function FeatureCell({ value }: { value: FeatureValue }) {
  if (value === true) {
    return (
      <span className="plans-yes">
        <span aria-hidden="true">✓</span>
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="plans-no">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span>{value}</span>;
}

export interface PlansViewProps {
  billing?: BillingAdapter;
  authService?: AuthService;
  /** Shows the "demo mode" notice; defaults to the resolved billing mode. */
  demo?: boolean;
}

export function PlansView({
  billing = defaultBilling,
  authService = defaultAuth,
  demo = services.mode.billing === 'mock',
}: PlansViewProps) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [selected, setSelected] = useState<PlanId>(RECOMMENDED);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // Resolve who we're billing: the signed-in user, else a local guest.
  useEffect(() => {
    let alive = true;
    authService
      .currentUser()
      .then((u) => alive && setUserId(u?.id ?? GUEST_BILLING_ID))
      .catch(() => alive && setUserId(GUEST_BILLING_ID));
    const unsubscribe = authService.onAuthStateChange((u) => setUserId(u?.id ?? GUEST_BILLING_ID));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [authService]);

  useEffect(() => {
    let alive = true;
    billing
      .getPlans()
      .then((p) => alive && setPlans(p))
      .catch(() => alive && setError('Plans could not be loaded. Please try again.'));
    return () => {
      alive = false;
    };
  }, [billing]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    billing
      .getSubscription(userId)
      .then((s) => {
        if (!alive) return;
        setSubscription(s);
        // Pre-select the next tier up, so the CTA is always an upgrade when possible.
        if (s.status !== 'canceled' && s.planId !== 'free') setSelected('premium');
      })
      .catch(() => alive && setError('Your current plan could not be loaded.'));
    return () => {
      alive = false;
    };
  }, [billing, userId]);

  const currentPlanId =
    subscription && subscription.status !== 'canceled' ? subscription.planId : null;
  const selectedPlan = useMemo(
    () => plans?.find((p) => p.id === selected) ?? null,
    [plans, selected],
  );
  const selectedIsCurrent = selected === currentPlanId;

  const checkout = useCallback(async () => {
    if (!userId || !selectedPlan || pending) return;
    setPending(true);
    setError(null);
    setConfirmation(null);
    try {
      const result = await billing.startCheckout(userId, selectedPlan.id);
      setSubscription(result.subscription);
      if (
        result.subscription.planId === selectedPlan.id &&
        result.subscription.status !== 'canceled'
      ) {
        const trial = result.subscription.status === 'trialing' ? ' Your trial has started.' : '';
        setConfirmation(`You're on ${selectedPlan.name}.${trial}`);
      } else if (isSafeCheckoutUrl(result.url)) {
        if (result.url.startsWith('/')) navigate(result.url);
        else window.location.assign(result.url);
      } else {
        setError('Checkout could not be started. Please try again.');
      }
    } catch {
      setError('Checkout could not be started. Please try again.');
    } finally {
      setPending(false);
    }
  }, [billing, navigate, pending, selectedPlan, userId]);

  const ctaLabel = !selectedPlan
    ? 'Choose a plan'
    : selectedIsCurrent
      ? `You're on ${selectedPlan.name}`
      : currentPlanId && comparePlanTier(selected, currentPlanId) < 0
        ? `Switch to ${selectedPlan.name}`
        : selectedPlan.priceCents > 0
          ? `Start ${selectedPlan.name} · ${formatPrice(selectedPlan.priceCents, selectedPlan.currency)}/mo`
          : `Continue with ${selectedPlan.name}`;

  return (
    <main className="page plans-page">
      <div className="plans-shell">
        <header className="plans-header">
          <h1>Choose your plan</h1>
          <p className="muted">
            Switch or cancel any time. Every plan includes your watchlist, history and profiles.
          </p>
          {demo && (
            <p className="plans-demo glass" role="note">
              Demo mode: no payment is taken and no card is needed.
            </p>
          )}
        </header>

        {plans === null && !error && (
          <div className="plans-grid" aria-busy="true" aria-label="Loading plans">
            {[0, 1, 2].map((i) => (
              <div key={i} className="plan-card skeleton" />
            ))}
          </div>
        )}

        {plans && (
          <>
            <ul className="plans-grid" aria-label="Plans">
              {plans.map((plan, i) => {
                const isSelected = plan.id === selected;
                const isCurrent = plan.id === currentPlanId;
                return (
                  <li
                    key={plan.id}
                    className={`plan-card glass${isSelected ? ' selected' : ''}${plan.id === RECOMMENDED ? ' recommended' : ''}`}
                    style={{ animationDelay: `${i * 80}ms` }}
                    onClick={() => setSelected(plan.id)}
                  >
                    <span className="plan-badges">
                      {plan.id === RECOMMENDED && (
                        <span className="plan-badge accent">Most popular</span>
                      )}
                      {isCurrent && <span className="plan-badge">Current plan</span>}
                    </span>
                    <h2 className="plan-name">{plan.name}</h2>
                    <p className="plan-price">
                      {formatPrice(plan.priceCents, plan.currency)}
                      {plan.priceCents > 0 && <span className="plan-period">/mo</span>}
                    </p>
                    <p className="plan-tagline">{TAGLINES[plan.id]}</p>
                    <ul className="plan-features">
                      {plan.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <Button
                      variant={isSelected ? 'primary' : 'glass'}
                      className="plan-select"
                      aria-pressed={isSelected}
                      aria-label={`Select ${plan.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(plan.id);
                      }}
                    >
                      {isSelected ? 'Selected' : `Select ${plan.name}`}
                    </Button>
                  </li>
                );
              })}
            </ul>

            <section className="plans-compare glass" aria-labelledby="plans-compare-title">
              <h2 id="plans-compare-title">Compare plans</h2>
              <div className="plans-table-wrap">
                <table className="plans-table">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">Feature</span>
                      </th>
                      {plans.map((p) => (
                        <th
                          key={p.id}
                          scope="col"
                          className={p.id === selected ? 'selected' : undefined}
                        >
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PLAN_FEATURES.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        {plans.map((p) => (
                          <td key={p.id} className={p.id === selected ? 'selected' : undefined}>
                            <FeatureCell value={row.values[p.id]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <div className="plans-cta glass">
          <Button
            variant="accent"
            size="lg"
            onClick={checkout}
            loading={pending}
            disabled={!selectedPlan || !userId || selectedIsCurrent}
          >
            {ctaLabel}
          </Button>
          <p className="plans-status" role="status" aria-live="polite">
            {confirmation && (
              <>
                {confirmation} <Link to="/account">Manage in Account</Link>
              </>
            )}
          </p>
          {error && (
            <p className="plans-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PlansPage() {
  return <PlansView />;
}
