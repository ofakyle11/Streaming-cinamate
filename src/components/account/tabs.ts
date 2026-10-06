export const ACCOUNT_TABS = [
  { id: 'security', label: 'Sign-in & security' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'history', label: 'Viewing history' },
  { id: 'data', label: 'Your data' },
] as const;

export type AccountTabId = (typeof ACCOUNT_TABS)[number]['id'];

export function isAccountTab(value: string | null): value is AccountTabId {
  return ACCOUNT_TABS.some((t) => t.id === value);
}

/** The security tab is the bare /account; the others carry ?tab=. */
export function accountTabHref(tab: AccountTabId): string {
  return tab === 'security' ? '/account' : `/account?tab=${tab}`;
}
