import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BrandPage from './BrandPage';

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

function renderAt(url = '/brand') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <BrandPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const options = () => within(screen.getByRole('group', { name: 'Logo options' }));
const colourways = () => within(screen.getByRole('group', { name: 'Colourways' }));

describe('BrandPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the deck with four logo options and the shipped direction selected by default', () => {
    renderAt();
    expect(document.title).toBe('Brand kit · Last Frame');
    expect(screen.getByRole('heading', { level: 1, name: /Brand\s*kit/ })).toBeInTheDocument();
    const buttons = options().getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'true',
    ]);
    expect(buttons[0]).toHaveTextContent('01 / Monogram');
    expect(buttons[3]).toHaveTextContent('04 / Countdown');
    expect(screen.getAllByRole('region').length).toBe(10);
  });

  it('choosing an option updates the URL and every mark on the page', () => {
    renderAt();
    fireEvent.click(options().getByRole('button', { name: /03 \/ Strip/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/brand?option=strip');
    expect(options().getByRole('button', { name: /03 \/ Strip/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const marks = Array.from(document.querySelectorAll('.brand-mark'));
    expect(marks.length).toBeGreaterThan(10);
    // Everything outside the option grid and the min-size strip now draws the Strip mark.
    const outsideGrid = marks.filter((m) => !m.closest('.bk-options'));
    expect(outsideGrid.every((m) => m.getAttribute('data-mark') === 'strip')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Download' })[0]).toHaveAttribute(
      'href',
      '/brand/lf-strip-mark.svg',
    );
  });

  it('reads the option and colourway from the URL and ignores unknown values', () => {
    renderAt('/brand?option=countdown&colour=lagoon');
    expect(options().getByRole('button', { name: /04 \/ Countdown/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(colourways().getByRole('button', { name: /Lagoon/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const stops = Array.from(
      document.querySelectorAll('.bk-forms .brand-mark linearGradient stop'),
    ).map((s) => s.getAttribute('stop-color'));
    expect(stops).toContain('#06b6d4');
    expect(stops).not.toContain('#7c3aed');

    renderAt('/brand?option=bogus&colour=bogus');
    const all = screen.getAllByRole('group', { name: 'Logo options' });
    expect(
      within(all[all.length - 1]).getByRole('button', { name: /04 \/ Countdown/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('switching colourway keeps the option and vice versa', () => {
    renderAt('/brand?option=frame');
    fireEvent.click(colourways().getByRole('button', { name: /Ember/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/brand?option=frame&colour=ember');
    fireEvent.click(options().getByRole('button', { name: /02 \/ Frame/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/brand?option=frame&colour=ember');
  });

  it('copies a colour and the SVG source to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderAt('/brand?option=strip&colour=dusk');
    fireEvent.click(screen.getByRole('button', { name: 'Copy Signal #e50914' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('#e50914'));
    expect(await screen.findByRole('button', { name: 'Copy Signal #e50914' })).toHaveTextContent(
      'Copied',
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy SVG' })[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    const svg = writeText.mock.calls[1][0] as string;
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"');
    expect(svg).toContain('stop-color="#ec4899"');
  });

  it('labels every lockup and mark once, and hides mockup copies', () => {
    renderAt();
    // The headline lockups are images with the brand name.
    expect(screen.getAllByRole('img', { name: 'Last Frame' }).length).toBeGreaterThan(2);
    // Mockups are decorative wrappers; nothing inside them is exposed.
    const navMock = document.querySelector('.bk-navbar');
    expect(navMock).toHaveAttribute('aria-hidden', 'true');
    // Both app-icon tiles are named individually.
    expect(screen.getByRole('img', { name: 'Countdown app icon, night tile' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Countdown app icon, gradient tile' }),
    ).toBeInTheDocument();
  });

  it('can preview the selected option in the app and go back to the default', () => {
    window.localStorage.removeItem('lf.brand');
    renderAt('/brand?option=frame&colour=lagoon');
    const group = within(screen.getByRole('group', { name: 'App preview' }));
    expect(group.getByText(/shipped default/)).toBeInTheDocument();
    fireEvent.click(group.getByRole('button', { name: 'Try it in the app' }));
    expect(window.localStorage.getItem('lf.brand')).toBe(
      JSON.stringify({ mark: 'frame', colourway: 'lagoon' }),
    );
    expect(group.getByText(/02 \/ Frame · Lagoon/)).toBeInTheDocument();
    expect(group.getByText(/preview in this browser/)).toBeInTheDocument();
    expect(group.getByRole('button', { name: 'Showing in the app' })).toBeDisabled();
    fireEvent.click(group.getByRole('button', { name: 'Back to default' }));
    expect(window.localStorage.getItem('lf.brand')).toBeNull();
    expect(group.getByText(/shipped default/)).toBeInTheDocument();
  });
});
