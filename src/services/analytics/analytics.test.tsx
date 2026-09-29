import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { analytics, services } from '../index';
import { AnalyticsEvents, track, trackPage } from './track';
import { usePageViews } from '../../hooks/usePageViews';
import { createMockAnalytics } from './mock';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('service locator', () => {
  it('uses the mock analytics adapter with no env vars', () => {
    expect(services.mode.analytics).toBe('mock');
  });

  it('switches to plausible when VITE_PLAUSIBLE_DOMAIN is set', async () => {
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'lastframe.tv');
    vi.resetModules();
    const mod = await import('../index');
    expect(mod.services.mode.analytics).toBe('live');
  });
});

describe('mock adapter', () => {
  it('logs to console only when debug is on', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    createMockAnalytics({ debug: false }).track('search');
    expect(spy).not.toHaveBeenCalled();
    const m = createMockAnalytics({ debug: true });
    m.page('/', { path: '/' });
    expect(spy).toHaveBeenCalledWith('[analytics:page]', '/', expect.objectContaining({ path: '/' }));
    expect(m.events()).toHaveLength(1);
  });
});

describe('track helpers', () => {
  it('forward to the active adapter', () => {
    const t = vi.spyOn(analytics, 'track');
    const p = vi.spyOn(analytics, 'page');
    track(AnalyticsEvents.addToList, { id: 1 });
    trackPage('/x', { path: '/x' });
    expect(t).toHaveBeenCalledWith('add-to-list', { id: 1 });
    expect(p).toHaveBeenCalledWith('/x', { path: '/x' });
  });

  it('never throw', () => {
    vi.spyOn(analytics, 'track').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => track(AnalyticsEvents.search)).not.toThrow();
  });
});

describe('usePageViews', () => {
  it('emits a page view on mount and on each route change', () => {
    const page = vi.spyOn(analytics, 'page').mockImplementation(() => {});
    let go: (to: string) => void = () => {};
    function Probe() {
      usePageViews();
      go = useNavigate();
      return null;
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(page).toHaveBeenLastCalledWith('/', { path: '/' });
    act(() => go('/search?q=dune'));
    expect(page).toHaveBeenLastCalledWith('/search', { path: '/search?q=dune' });
    act(() => go('/search?q=dune'));
    expect(page).toHaveBeenCalledTimes(2);
  });
});
