import { beforeEach, describe, expect, it } from 'vitest';
import initSource from '../../public/theme-init.js?raw';
import indexHtml from '../../index.html?raw';
import { THEME_COLORS } from './theme';

/** Runs public/theme-init.js against the jsdom document, as the browser does before paint. */
function runInit() {
  new Function(initSource)();
}

function installHead() {
  document.head.innerHTML =
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#000000">' +
    '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000">';
}
const metas = () =>
  Array.from(document.querySelectorAll('meta[name="theme-color"]')).map((m) =>
    m.getAttribute('content'),
  );

describe('public/theme-init.js', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    installHead();
  });

  it('has no inline script, so it works under script-src self', () => {
    expect(indexHtml).toMatch(/<script src="\/theme-init\.js"><\/script>/);
    expect(indexHtml).not.toMatch(/<script(?![^>]*src=)[^>]*>\s*\S/);
  });

  it('runs after the theme-color metas and before the app module', () => {
    const script = indexHtml.indexOf('<script src="/theme-init.js">');
    const lastMeta = indexHtml.lastIndexOf('name="theme-color"');
    const app = indexHtml.indexOf('<script type="module"');
    expect(script).toBeGreaterThan(lastMeta);
    expect(script).toBeLessThan(app);
    expect(indexHtml).not.toMatch(/<html[^>]*data-theme/);
  });

  it('applies a saved dark theme to <html> and both metas', () => {
    localStorage.setItem('lf.theme', 'dark');
    runInit();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(metas()).toEqual([THEME_COLORS.dark, THEME_COLORS.dark]);
  });

  it('applies a saved light theme', () => {
    localStorage.setItem('lf.theme', 'light');
    runInit();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(metas()).toEqual([THEME_COLORS.light, THEME_COLORS.light]);
  });

  it('follows the device when nothing valid is saved', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('lf.theme', 'bogus');
    runInit();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(metas()).toEqual([THEME_COLORS.light, THEME_COLORS.dark]);
  });

  it('uses the same key and colours as the theme module', () => {
    expect(initSource).toContain("'lf.theme'");
    expect(initSource).toContain(`'${THEME_COLORS.light}'`);
    expect(initSource).toContain(`'${THEME_COLORS.dark}'`);
  });
});
