import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfflineBanner from './OfflineBanner';

describe('OfflineBanner', () => {
  let online = true;

  beforeEach(() => {
    online = true;
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setOnline = (value: boolean) => {
    online = value;
    act(() => {
      window.dispatchEvent(new Event(value ? 'online' : 'offline'));
    });
  };

  it('renders an empty polite live region while online', () => {
    render(<OfflineBanner />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toBeEmptyDOMElement();
  });

  it('shows the glass banner immediately when mounted offline', () => {
    online = false;
    render(<OfflineBanner />);
    expect(screen.getByText(/you're offline/i)).toHaveClass('offline-banner', 'glass');
  });

  it('shows the banner when going offline', () => {
    render(<OfflineBanner />);
    setOnline(false);
    expect(screen.getByRole('status')).toHaveTextContent(/you're offline/i);
  });

  it("announces 'Back online' after coming back and clears it on the next outage", () => {
    render(<OfflineBanner />);
    setOnline(false);
    setOnline(true);
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Back online.');
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();

    setOnline(false);
    expect(screen.queryByText(/back online/i)).not.toBeInTheDocument();
    expect(region).toHaveTextContent(/you're offline/i);
  });
});
