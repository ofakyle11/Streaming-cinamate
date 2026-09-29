import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorCard from './ErrorCard';

describe('ErrorCard', () => {
  it('renders an alert region with the default title and message', () => {
    render(<ErrorCard />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('error-card', 'glass');
    expect(alert).toHaveAccessibleName('Something went wrong');
    expect(screen.getByText(/this scene failed to load/i)).toBeInTheDocument();
  });

  it('focuses the heading on mount', () => {
    render(<ErrorCard title="Broken reel" />);
    expect(screen.getByRole('heading', { name: 'Broken reel' })).toHaveFocus();
  });

  it('calls onRetry when the Try again button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorCard onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses a custom retry label', () => {
    render(<ErrorCard onRetry={() => {}} retryLabel="Reload" />);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('renders no retry button when onRetry is undefined', () => {
    render(<ErrorCard />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('links Go home to the root', () => {
    render(<ErrorCard />);
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });

  it('hides the Go home link when showHome is false', () => {
    render(<ErrorCard showHome={false} />);
    expect(screen.queryByRole('link', { name: /go home/i })).not.toBeInTheDocument();
  });
});
