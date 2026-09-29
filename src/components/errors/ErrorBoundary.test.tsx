import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';
import OfflineBanner from './OfflineBanner';

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('kaboom');
  return <p>Recovered content</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React logs caught render errors; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    shouldThrow = false;
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });

  it('shows the glass error card and focuses its heading', () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveClass('error-card', 'glass');
    const heading = screen.getByRole('heading', { name: /something went wrong/i });
    expect(heading).toHaveFocus();
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });

  it('retry re-renders children', () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });

  it('resets when resetKey changes (location change)', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false;
    rerender(
      <ErrorBoundary resetKey="/b">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });

  it('calls onError and supports a custom fallback', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError} fallback={(e) => <p>Custom: {e.message}</p>}>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom: kaboom')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.anything());
  });
});

describe('OfflineBanner', () => {
  let online = true;
  beforeEach(() => {
    online = true;
    vi.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => online);
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

  it('shows a polite status banner while offline and announces recovery', () => {
    render(<OfflineBanner />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();

    setOnline(false);
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();

    setOnline(true);
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();
    expect(screen.getByText(/back online/i)).toBeInTheDocument();
  });
});
