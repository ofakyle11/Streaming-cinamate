import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstallAppCard from './InstallAppCard';
import { ToastProvider } from './ui';
import { BeforeInstallPromptEvent, resetInstallPrompt } from '../pwa/install';

function fireInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, { platforms: ['web'], userChoice: Promise.resolve({ outcome, platform: 'web' }), prompt });
  act(() => {
    window.dispatchEvent(event);
  });
  return prompt;
}

const renderCard = () =>
  render(
    <ToastProvider>
      <InstallAppCard />
    </ToastProvider>,
  );

beforeEach(() => resetInstallPrompt());
afterEach(() => resetInstallPrompt());

describe('InstallAppCard', () => {
  it('shows guidance without a button when the browser has not offered install', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Get the app' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /install app/i })).not.toBeInTheDocument();
  });

  it('shows the install button once the prompt is captured and installs on click', async () => {
    renderCard();
    const prompt = fireInstallPrompt('accepted');
    const button = screen.getByRole('button', { name: /install app/i });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(/installed on this device/i)).toBeInTheDocument());
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /install app/i })).not.toBeInTheDocument();
  });

  it('hides the button after the user dismisses the prompt', async () => {
    renderCard();
    fireInstallPrompt('dismissed');
    fireEvent.click(screen.getByRole('button', { name: /install app/i }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /install app/i })).not.toBeInTheDocument());
  });
});
