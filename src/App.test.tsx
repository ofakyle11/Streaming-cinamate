import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the Lastframe.tv footer', () => {
    render(<App />);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('Lastframe.tv')).toBeInTheDocument();
    const legal = within(footer).getByRole('navigation', { name: 'Legal' });
    expect(
      within(legal)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/privacy', '/terms', '/security', '/brand']);
  });
});
