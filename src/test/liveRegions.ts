import { screen, waitFor, type waitForOptions } from '@testing-library/react';

export type LiveRole = 'status' | 'alert';

/**
 * Live regions currently carrying a message. ToastProvider keeps its polite
 * (`status`) and assertive (`alert`) stacks mounted at all times so screen
 * readers pick up insertions; an empty toast stack is not a message.
 */
export const liveRegions = (role: LiveRole) =>
  screen
    .queryAllByRole(role)
    .filter((el) => !(el.classList.contains('toast-stack') && el.childElementCount === 0));

export const getLive = (role: LiveRole) => {
  const found = liveRegions(role);
  if (found.length !== 1) throw new Error(`Expected one non-empty ${role}, found ${found.length}`);
  return found[0];
};

export const findLive = (role: LiveRole, options?: waitForOptions) => waitFor(() => getLive(role), options);

export const queryLive = (role: LiveRole) => liveRegions(role)[0] ?? null;
