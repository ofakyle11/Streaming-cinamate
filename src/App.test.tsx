import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the Last Frame footer', () => {
    render(<App />);
    expect(screen.getByText(/Last Frame · lastframe.tv/i)).toBeInTheDocument();
  });
});
