import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { GUEST_BILLING_ID, PlansView } from './PlansPage';
import { createMockBilling } from '../services/billing/mock';
import type { AuthService, BillingAdapter, User } from '../services';

function fakeAuth(user: User | null): AuthService {
  return {
    currentUser: async () => user,
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInWithMagicLink: vi.fn(),
    signInWithOAuth: vi.fn(),
    completeSignIn: vi.fn(),
    requestDataDeletion: vi.fn(),
    signOut: vi.fn(),
    listDevices: vi.fn(async () => []),
    forgetDevice: vi.fn(),
    changeEmail: vi.fn(),
    onAuthStateChange: () => () => {},
  };
}

const alice: User = {
  id: 'alice',
  email: 'a@example.com',
  displayName: 'Alice',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderPlans(billing: BillingAdapter, user: User | null = alice) {
  return render(
    <MemoryRouter>
      <PlansView billing={billing} authService={fakeAuth(user)} demo />
    </MemoryRouter>,
  );
}

describe('PlansPage', () => {
  it('renders three plan cards, the comparison table and a CTA', async () => {
    renderPlans(createMockBilling({ storage: null }));
    const cards = await screen.findAllByRole('heading', {
      level: 2,
      name: /^(Free|Plus|Premium)$/,
    });
    expect(cards.map((h) => h.textContent)).toEqual(['Free', 'Plus', 'Premium']);
    expect(screen.getByText('$7.99')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Ad-free' })).toBeInTheDocument();
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Start Plus · \$7\.99\/mo/ })).toBeEnabled();
  });

  it('marks the current plan and disables checkout for it', async () => {
    const billing = createMockBilling({ storage: null });
    await billing.startCheckout('alice', 'premium');
    renderPlans(billing);
    expect(await screen.findByText('Current plan')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: "You're on Premium" })).toBeDisabled();
  });

  it('selecting a plan and checking out stores the fake subscription', async () => {
    const billing = createMockBilling({ storage: null });
    renderPlans(billing);
    const premium = await screen.findByRole('button', { name: 'Select Premium' });
    fireEvent.click(premium);
    expect(premium).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(await screen.findByRole('button', { name: /Start Premium/ }));
    const status = screen.getByRole('status');
    expect(
      await within(status).findByText(/You're on Premium\. Your trial has started\./),
    ).toBeInTheDocument();
    expect(within(status).getByRole('link', { name: /Manage in Account/ })).toHaveAttribute(
      'href',
      '/account',
    );
    expect(await billing.getSubscription('alice')).toMatchObject({
      planId: 'premium',
      status: 'trialing',
    });
  });

  it('bills a local guest when nobody is signed in', async () => {
    const billing = createMockBilling({ storage: null });
    renderPlans(billing, null);
    fireEvent.click(await screen.findByRole('button', { name: /Start Plus/ }));
    await within(screen.getByRole('status')).findByText(/You're on Plus/);
    expect(await billing.getSubscription(GUEST_BILLING_ID)).toMatchObject({ planId: 'plus' });
  });

  it('shows an error when checkout fails', async () => {
    const base = createMockBilling({ storage: null });
    const failing: BillingAdapter = {
      ...base,
      startCheckout: vi.fn().mockRejectedValue(new Error('boom')),
    };
    renderPlans(failing);
    fireEvent.click(await screen.findByRole('button', { name: /Start Plus/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be started/);
  });
});
